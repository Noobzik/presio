// Controller dashboard card layout: configuration + persistence.
//
// The controller is a tiling window manager (react-mosaic) of cards: current
// slide, next slide, timer, notes, thumbnails. Cards always tile to fill the
// screen, so removing or resizing one makes its neighbours grow rather than
// leaving a hole. The layout is a binary tree (`MosaicNode`); a card is visible
// iff it appears as a leaf in that tree. This module owns the card catalog, the
// default tree, and the localStorage load/sanitize/save logic so the view
// component only deals with React state.

import { getLeaves, createRemoveUpdate, updateTree } from "react-mosaic-component";
import type { MosaicNode, MosaicParent, MosaicPath } from "react-mosaic-component";
import { lsGet, lsSet, STORAGE_KEYS } from "./storage";

interface CardConfig {
  key: string;
  label: string;
}

const CARD_CONFIGS: CardConfig[] = [
  { key: "currentSlide", label: "Current Slide" },
  { key: "nextSlide", label: "Next Slide" },
  { key: "timer", label: "Timer" },
  { key: "notes", label: "Speaker Notes" },
  { key: "thumbnails", label: "Thumbnails" },
];

export const CARD_KEYS = CARD_CONFIGS.map((c) => c.key);
export const CARD_LABELS: Record<string, string> = Object.fromEntries(
  CARD_CONFIGS.map((c) => [c.key, c.label]),
);

/** Default arrangement, mirroring the previous grid: current slide on the left,
 *  next slide + timer stacked over speaker notes on the right, thumbnails as a
 *  full-width strip along the bottom. `splitPercentage` is the share given to
 *  `first`. */
export const DEFAULT_LAYOUT: MosaicNode<string> = {
  direction: "column",
  first: {
    direction: "row",
    first: "currentSlide",
    second: {
      direction: "column",
      first: {
        direction: "row",
        first: "nextSlide",
        second: "timer",
        splitPercentage: 65,
      },
      second: "notes",
      splitPercentage: 62,
    },
    splitPercentage: 52,
  },
  second: "thumbnails",
  splitPercentage: 68,
};

function isParentNode(node: unknown): node is MosaicParent<string> {
  return (
    typeof node === "object" &&
    node !== null &&
    "direction" in node &&
    "first" in node &&
    "second" in node
  );
}

/** Project an untrusted parsed value onto the known cards. Unknown leaves are
 *  dropped, branches with a missing child collapse to the surviving child, and
 *  anything unrecognisable (e.g. the legacy array format) yields null so the
 *  caller can fall back to the default. */
function sanitize(node: unknown): MosaicNode<string> | null {
  if (typeof node === "string") return CARD_KEYS.includes(node) ? node : null;
  if (isParentNode(node)) {
    const first = sanitize(node.first);
    const second = sanitize(node.second);
    if (first && second) {
      const direction = node.direction === "column" ? "column" : "row";
      return { direction, first, second, splitPercentage: node.splitPercentage };
    }
    return first ?? second;
  }
  return null;
}

/** Keys currently shown as tiles, in the tree's canonical order. */
export function visibleKeys(node: MosaicNode<string> | null): string[] {
  return getLeaves(node).filter((k) => CARD_KEYS.includes(k));
}

function findPath(
  node: MosaicNode<string> | null,
  key: string,
  path: MosaicPath = [],
): MosaicPath | null {
  if (node == null) return null;
  if (typeof node === "string") return node === key ? path : null;
  return (
    findPath(node.first, key, [...path, "first"]) ??
    findPath(node.second, key, [...path, "second"])
  );
}

/** Add a card as a new full-height column on the right edge. No-op if already
 *  present or the key is unknown. */
export function addLeaf(node: MosaicNode<string> | null, key: string): MosaicNode<string> {
  if (!CARD_KEYS.includes(key)) return node ?? key;
  if (node == null) return key;
  if (findPath(node, key)) return node;
  return { direction: "row", first: node, second: key, splitPercentage: 75 };
}

/** Remove a card from the tree; neighbours expand to fill the space. Returns
 *  null if the removed card was the last one. */
export function removeLeaf(
  node: MosaicNode<string> | null,
  key: string,
): MosaicNode<string> | null {
  const path = findPath(node, key);
  if (node == null || path == null) return node;
  if (path.length === 0) return null; // removing the sole remaining tile
  return updateTree(node, [createRemoveUpdate(node, path)]);
}

export function loadLayout(): MosaicNode<string> {
  return sanitize(lsGet(STORAGE_KEYS.controllerMosaic, null)) ?? DEFAULT_LAYOUT;
}

export function saveLayout(node: MosaicNode<string> | null) {
  lsSet(STORAGE_KEYS.controllerMosaic, node);
}

export function savePreferred(node: MosaicNode<string> | null) {
  lsSet(STORAGE_KEYS.preferredMosaic, node);
}

export function hasPreferredLayout(): boolean {
  return sanitize(lsGet(STORAGE_KEYS.preferredMosaic, null)) !== null;
}

/** Load the user's saved "preferred" layout, or null if none is stored. */
export function loadPreferred(): MosaicNode<string> | null {
  return sanitize(lsGet(STORAGE_KEYS.preferredMosaic, null));
}
