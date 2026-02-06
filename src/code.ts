import type { UIMessage, PluginMessage, LogoAnalysis, GridConfig } from "./utils/types";
import { calculateGridLayout } from "./utils/grid-layout";

const STORAGE_KEY_TOKEN = "logo-soup-api-token";

figma.showUI(__html__, { themeColors: true, width: 360, height: 540 });

figma.ui.onmessage = async (msg: UIMessage) => {
  switch (msg.type) {
    case "load-token":
      await handleLoadToken();
      break;
    case "save-token":
      await handleSaveToken(msg.token);
      break;
    case "generate-grid":
      await handleGenerateGrid(msg.config, msg.logos);
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
): Promise<void> {
  if (logos.length === 0) {
    sendToUI({ type: "error", message: "No logos to generate" });
    return;
  }

  try {
    // Create the parent frame with auto-layout wrap
    const frame = figma.createFrame();
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

    // Calculate fixed width from grid layout
    const gridItems = calculateGridLayout(
      logos.map((l) => ({ width: l.normalizedWidth, height: l.normalizedHeight })),
      { columns: config.columns, gap: config.gap },
    );

    // Set frame width based on columns and max logo width
    const maxItemWidth = Math.max(...logos.map((l) => l.normalizedWidth));
    const frameWidth = maxItemWidth * config.columns + config.gap * (config.columns + 1);
    frame.resize(frameWidth, 100); // Height auto-adjusts

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

    // Position the frame in the viewport
    frame.x = Math.round(figma.viewport.center.x - frameWidth / 2);
    frame.y = Math.round(figma.viewport.center.y);

    figma.currentPage.appendChild(frame);
    figma.currentPage.selection = [frame];
    figma.viewport.scrollAndZoomIntoView([frame]);

    sendToUI({ type: "complete" });
    figma.notify(`Logo Soup: ${logos.length} logos generated`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    sendToUI({ type: "error", message });
  }
}

async function createLogoNode(
  logo: LogoAnalysis,
  config: GridConfig,
): Promise<FrameNode> {
  const container = figma.createFrame();
  container.name = logo.domain;
  container.resize(
    Math.round(logo.normalizedWidth),
    Math.round(logo.normalizedHeight),
  );
  container.fills = [];

  // Fetch the image via Figma's built-in image fetcher
  const image = await figma.createImageAsync(logo.url);

  // Create the image rectangle
  const rect = figma.createRectangle();
  rect.name = `${logo.domain}-image`;
  rect.resize(
    Math.round(logo.normalizedWidth),
    Math.round(logo.normalizedHeight),
  );
  rect.fills = [
    {
      type: "IMAGE",
      imageHash: image.hash,
      scaleMode: "FIT",
    },
  ];

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
