import type { UIMessage, PluginMessage, GridConfig, CanvasLogo } from "./utils/types";
import { calculateNormalizedWidth, calculateNormalizedHeight } from "./utils/normalize";

const DOMAIN_REGEX = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;
const FRAME_NAME = "Logo Soup";

function extractNodeAsCanvasLogo(node: SceneNode): CanvasLogo {
  const isDomain = DOMAIN_REGEX.test(node.name);
  const domain = isDomain ? node.name : "unknown";

  let imageHash: string | undefined;
  if ("fills" in node && Array.isArray(node.fills)) {
    const imageFill = (node.fills as Paint[]).find((f) => f.type === "IMAGE") as ImagePaint | undefined;
    if (imageFill?.imageHash) imageHash = imageFill.imageHash;
  }

  if (node.type === "VECTOR" || node.type === "BOOLEAN_OPERATION") {
    return { domain, width: node.width, height: node.height, isSvg: true, nodeId: node.id };
  }

  return { domain, width: node.width, height: node.height, imageHash };
}

function extractCanvasSelection(): void {
  const selection = figma.currentPage.selection;
  const logos: CanvasLogo[] = [];

  for (const node of selection) {
    if (node.name === FRAME_NAME && "children" in node) {
      for (const child of (node as ChildrenMixin).children) {
        logos.push(extractNodeAsCanvasLogo(child as SceneNode));
      }
    } else {
      logos.push(extractNodeAsCanvasLogo(node));
    }
  }

  const hasExistingGrid = figma.currentPage.children.some(
    (n) => n.name === FRAME_NAME
  );

  sendToUI({ type: "selection-detected", logos, hasExistingGrid });
}

figma.showUI(__html__, { themeColors: true, width: 360, height: 540 });
extractCanvasSelection();

figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case "generate-grid":
      await handleGenerateGrid(msg.config, msg.canvasLogos, msg.appendToExisting);
      break;
  }
};

function applyGridLayout(
  node: FrameNode | ComponentNode,
  config: GridConfig,
  frameWidth: number,
): void {
  node.name = FRAME_NAME;
  node.layoutMode = "HORIZONTAL";
  node.layoutWrap = "WRAP";
  node.primaryAxisSizingMode = "FIXED";
  node.counterAxisSizingMode = "AUTO";
  node.itemSpacing = config.gap;
  node.counterAxisSpacing = config.gap;
  node.paddingLeft = config.gap;
  node.paddingRight = config.gap;
  node.paddingTop = config.gap;
  node.paddingBottom = config.gap;
  node.fills = [];
  node.resize(frameWidth, 100);
}

async function handleGenerateGrid(
  config: GridConfig,
  canvasLogos: CanvasLogo[],
  appendToExisting?: boolean,
): Promise<void> {
  if (canvasLogos.length === 0) {
    sendToUI({ type: "error", message: "No logos to generate" });
    return;
  }

  try {
    const opts = { baseSize: config.baseSize, scaleFactor: config.scaleFactor };
    const normalizedWidths = canvasLogos.map((cl) =>
      calculateNormalizedWidth(cl.width > 0 && cl.height > 0 ? cl.width / cl.height : 1, opts)
    );
    const maxItemWidth = Math.max(...normalizedWidths);
    const frameWidth = maxItemWidth * config.columns + config.gap * (config.columns + 1);

    let frame: FrameNode;
    const existingFrame = appendToExisting
      ? (figma.currentPage.children.find((n) => n.name === FRAME_NAME) as FrameNode | undefined)
      : undefined;

    if (existingFrame) {
      frame = existingFrame;
    } else {
      frame = figma.createFrame();
      applyGridLayout(frame, config, frameWidth);
    }

    for (const cl of canvasLogos) {
      const aspectRatio = cl.width > 0 && cl.height > 0 ? cl.width / cl.height : 1;
      const nw = calculateNormalizedWidth(aspectRatio, opts);
      const nh = calculateNormalizedHeight(aspectRatio, opts);
      const node = createCanvasLogoNode(cl, nw, nh);
      frame.appendChild(node as Parameters<typeof frame.appendChild>[0]);
    }

    if (!existingFrame) {
      frame.x = Math.round(figma.viewport.center.x - frameWidth / 2);
      frame.y = Math.round(figma.viewport.center.y);
    }

    let resultNode: SceneNode = frame;
    if (config.exportAsComponent) {
      const component = figma.createComponent();
      applyGridLayout(component, config, frameWidth);

      const children = [...frame.children];
      for (const child of children) {
        component.appendChild(child);
      }

      component.x = frame.x;
      component.y = frame.y;
      frame.remove();
      resultNode = component;
    }

    figma.currentPage.appendChild(resultNode);
    figma.currentPage.selection = [resultNode];
    figma.viewport.scrollAndZoomIntoView([resultNode]);

    sendToUI({ type: "complete" });
    const count = canvasLogos.length;
    const word = count === 1 ? "logo" : "logos";
    const suffix = config.exportAsComponent ? " (Component)" : "";
    const undoTarget = resultNode;
    figma.notify(`Logo Soup: ${count} ${word} generated${suffix}`, {
      timeout: 10000,
      button: {
        text: "Undo",
        action: () => {
          undoTarget.remove();
          figma.notify("Logo Soup removed");
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    sendToUI({ type: "error", message });
  }
}

function createCanvasLogoNode(
  logo: CanvasLogo,
  normalizedWidth: number,
  normalizedHeight: number,
): SceneNode {
  const w = Math.round(normalizedWidth);
  const h = Math.round(normalizedHeight);

  if (logo.isSvg && logo.nodeId) {
    const original = figma.getNodeById(logo.nodeId);
    if (original && "clone" in original) {
      const cloned = (original as SceneNode & { clone(): SceneNode }).clone();
      if ("resize" in cloned) {
        (cloned as SceneNode & { resize(w: number, h: number): void }).resize(w, h);
      }
      return cloned;
    }
  }

  if (!logo.imageHash) {
    const placeholder = figma.createFrame();
    placeholder.name = `${logo.domain} (no image)`;
    placeholder.resize(w, h);
    placeholder.fills = [{ type: "SOLID", color: { r: 0.94, g: 0.94, b: 0.94 } }];
    return placeholder;
  }

  const container = figma.createFrame();
  container.name = logo.domain;
  container.resize(w, h);
  container.fills = [];
  container.clipsContent = true;

  const rect = figma.createRectangle();
  rect.name = `${logo.domain}-image`;
  rect.resize(w, h);
  rect.fills = [{ type: "IMAGE", imageHash: logo.imageHash, scaleMode: "FIT" }];

  container.appendChild(rect);
  return container;
}

function sendToUI(msg: PluginMessage): void {
  figma.ui.postMessage(msg);
}
