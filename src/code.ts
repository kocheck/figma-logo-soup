import type { UIMessage, PluginMessage, LogoAnalysis, GridConfig, CanvasLogo } from "./utils/types";
import { calculateGridLayout } from "./utils/grid-layout";
import { calculateNudge } from "./utils/visual-center";
import { calculateNormalizedWidth, calculateNormalizedHeight } from "./utils/normalize";

const STORAGE_KEY_TOKEN = "logo-soup-api-token";

const DOMAIN_REGEX = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;

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
    if (node.name === "Logo Soup" && "children" in node) {
      for (const child of (node as ChildrenMixin).children) {
        logos.push(extractNodeAsCanvasLogo(child as SceneNode));
      }
    } else {
      logos.push(extractNodeAsCanvasLogo(node));
    }
  }

  const hasExistingGrid = figma.currentPage.children.some(
    (n) => n.name === "Logo Soup"
  );

  sendToUI({ type: "selection-detected", logos, hasExistingGrid });
}

figma.showUI(__html__, { themeColors: true, width: 360, height: 540 });
extractCanvasSelection();

figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case "load-token":
      await handleLoadToken();
      break;
    case "save-token":
      await handleSaveToken(msg.token);
      break;
    case "generate-grid":
      await handleGenerateGrid(msg.config, msg.logos, msg.appendToExisting, msg.canvasLogos);
      break;
  }
};

async function handleLoadToken(): Promise<void> {
  const token = await figma.clientStorage.getAsync(STORAGE_KEY_TOKEN);
  sendToUI({ type: "token-loaded", token: token ?? null });
}

async function handleSaveToken(token: string): Promise<void> {
  await figma.clientStorage.setAsync(STORAGE_KEY_TOKEN, token);
}

async function handleGenerateGrid(
  config: GridConfig,
  logos: LogoAnalysis[],
  appendToExisting?: boolean,
  canvasLogos?: CanvasLogo[],
): Promise<void> {
  if (logos.length === 0 && (!canvasLogos || canvasLogos.length === 0)) {
    sendToUI({ type: "error", message: "No logos to generate" });
    return;
  }

  try {
    // Compute max item width across both Logo.dev logos and canvas logos
    const allNormalizedWidths = [
      ...logos.map((l) => l.normalizedWidth),
      ...(canvasLogos ?? []).map((cl) =>
        calculateNormalizedWidth(cl.width / cl.height, {
          baseSize: config.baseSize,
          scaleFactor: config.scaleFactor,
          densityAware: false,
          densityFactor: 0,
        })
      ),
      config.baseSize,
    ];
    const maxItemWidth = Math.max(...allNormalizedWidths);
    const frameWidth = maxItemWidth * config.columns + config.gap * (config.columns + 1);

    let frame: FrameNode;
    const existingFrame = appendToExisting
      ? (figma.currentPage.children.find((n) => n.name === "Logo Soup") as FrameNode | undefined)
      : undefined;

    if (existingFrame) {
      frame = existingFrame;
    } else {
      frame = figma.createFrame();
      frame.name = "Logo Soup";
      frame.layoutMode = "HORIZONTAL";
      frame.layoutWrap = "WRAP";
      frame.primaryAxisSizingMode = "FIXED";
      frame.counterAxisSizingMode = "AUTO";
      frame.itemSpacing = config.gap;
      frame.counterAxisSpacing = config.gap;
      frame.paddingLeft = config.gap;
      frame.paddingRight = config.gap;
      frame.paddingTop = config.gap;
      frame.paddingBottom = config.gap;
      frame.fills = [];
      frame.resize(frameWidth, 100);
    }

    // Calculate fixed width from grid layout
    const gridItems = calculateGridLayout(
      logos.map((l) => ({ width: l.normalizedWidth, height: l.normalizedHeight })),
      { columns: config.columns, gap: config.gap },
    );
    void gridItems; // used for layout reference only

    // Load font for potential error labels
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });

    // Create logo nodes
    for (let i = 0; i < logos.length; i++) {
      const logo = logos[i];
      sendToUI({
        type: "progress",
        current: i + 1,
        total: logos.length,
        domain: logo.domain,
      });

      try {
        const logoNode = await createLogoNode(logo, config);
        frame.appendChild(logoNode);
      } catch (err) {
        const placeholder = createPlaceholderNode(logo);
        frame.appendChild(placeholder);
      }
    }

    // Place canvas-sourced logos (no network fetch needed)
    for (const cl of canvasLogos ?? []) {
      const aspectRatio = cl.width > 0 && cl.height > 0 ? cl.width / cl.height : 1;
      const opts = {
        baseSize: config.baseSize,
        scaleFactor: config.scaleFactor,
        densityAware: false as const,
        densityFactor: 0,
      };
      const nw = calculateNormalizedWidth(aspectRatio, opts);
      const nh = calculateNormalizedHeight(aspectRatio, opts);
      const node = createCanvasLogoNode(cl, nw, nh);
      frame.appendChild(node as Parameters<typeof frame.appendChild>[0]);
    }

    // Position the frame in the viewport (only for new frames)
    if (!existingFrame) {
      frame.x = Math.round(figma.viewport.center.x - frameWidth / 2);
      frame.y = Math.round(figma.viewport.center.y);
    }

    // Optionally convert to component
    let resultNode: SceneNode = frame;
    if (config.exportAsComponent) {
      const component = figma.createComponent();
      component.name = "Logo Soup";
      component.layoutMode = "HORIZONTAL";
      component.layoutWrap = "WRAP";
      component.primaryAxisSizingMode = "FIXED";
      component.counterAxisSizingMode = "AUTO";
      component.itemSpacing = config.gap;
      component.counterAxisSpacing = config.gap;
      component.paddingLeft = config.gap;
      component.paddingRight = config.gap;
      component.paddingTop = config.gap;
      component.paddingBottom = config.gap;
      component.fills = [];
      component.resize(frameWidth, 100);

      // Move children from frame to component
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
    const word = logos.length === 1 ? "logo" : "logos";
    const suffix = config.exportAsComponent ? " (Component)" : "";
    const undoTarget = resultNode;
    figma.notify(`Logo Soup: ${logos.length} ${word} generated${suffix}`, {
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

  // SVG path: clone the original vector node and resize it
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

  // If no imageHash is available, fall back to a placeholder frame
  if (!logo.imageHash) {
    const placeholder = figma.createFrame();
    placeholder.name = `${logo.domain} (no image)`;
    placeholder.resize(w, h);
    placeholder.fills = [{ type: "SOLID", color: { r: 0.94, g: 0.94, b: 0.94 } }];
    return placeholder;
  }

  // Image hash path: reuse existing image data, no network fetch
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

async function createLogoNode(
  logo: LogoAnalysis,
  config: GridConfig,
): Promise<FrameNode> {
  const w = Math.round(logo.normalizedWidth);
  const h = Math.round(logo.normalizedHeight);

  const container = figma.createFrame();
  container.name = logo.domain;
  container.resize(w, h);
  container.fills = [];
  container.clipsContent = true;

  // Fetch the image via Figma's built-in image fetcher
  const image = await figma.createImageAsync(logo.url);

  // Create the image rectangle
  const rect = figma.createRectangle();
  rect.name = `${logo.domain}-image`;
  rect.resize(w, h);
  rect.fills = [
    {
      type: "IMAGE",
      imageHash: image.hash,
      scaleMode: "FIT",
    },
  ];

  // Apply visual center nudge
  if (config.alignBy && config.alignBy !== "bounds") {
    const { nudgeX, nudgeY } = calculateNudge(
      logo.visualCenter,
      logo.naturalWidth,
      logo.naturalHeight,
      w,
      h,
      config.alignBy,
    );
    rect.x = Math.round(nudgeX);
    rect.y = Math.round(nudgeY);
  }

  container.appendChild(rect);
  return container;
}

function createPlaceholderNode(logo: LogoAnalysis): FrameNode {
  const container = figma.createFrame();
  container.name = `${logo.domain} (failed)`;
  container.resize(
    Math.round(logo.normalizedWidth),
    Math.round(logo.normalizedHeight),
  );
  container.fills = [
    {
      type: "SOLID",
      color: { r: 0.94, g: 0.94, b: 0.94 },
    },
  ];

  const label = figma.createText();
  label.characters = logo.domain;
  label.fontSize = 10;
  label.fills = [{ type: "SOLID", color: { r: 0.6, g: 0.6, b: 0.6 } }];
  label.x = 4;
  label.y = Math.round(logo.normalizedHeight / 2 - 6);

  container.appendChild(label);
  return container;
}

function sendToUI(msg: PluginMessage): void {
  figma.ui.postMessage(msg);
}
