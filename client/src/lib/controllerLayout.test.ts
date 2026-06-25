// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { Mosaic, MosaicWindow } from "react-mosaic-component";
import {
  DEFAULT_LAYOUT,
  CARD_KEYS,
  addLeaf,
  removeLeaf,
  visibleKeys,
} from "./controllerLayout";

describe("controllerLayout helpers", () => {
  it("DEFAULT_LAYOUT exposes every card as a leaf", () => {
    expect(visibleKeys(DEFAULT_LAYOUT).sort()).toEqual([...CARD_KEYS].sort());
  });

  it("removeLeaf drops a card and neighbours remain", () => {
    const without = removeLeaf(DEFAULT_LAYOUT, "timer");
    const keys = visibleKeys(without);
    expect(keys).not.toContain("timer");
    expect(keys).toContain("nextSlide");
    expect(keys).toHaveLength(CARD_KEYS.length - 1);
  });

  it("removeLeaf of the sole tile yields null", () => {
    expect(removeLeaf("currentSlide", "currentSlide")).toBeNull();
  });

  it("addLeaf restores a hidden card and is idempotent", () => {
    const without = removeLeaf(DEFAULT_LAYOUT, "notes");
    const back = addLeaf(without, "notes");
    expect(visibleKeys(back)).toContain("notes");
    // Adding an already-present card is a no-op (no duplicate leaves).
    expect(visibleKeys(addLeaf(back, "notes"))).toHaveLength(CARD_KEYS.length);
  });
});

describe("react-mosaic runtime", () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  // Regression guard: react-mosaic v6 pulled a nested react-dom@18 that crashed
  // under React 19 with "ReactCurrentDispatcher is undefined" at module eval /
  // mount. A successful mount proves the dedupe-to-one-react-dom fix holds.
  it("mounts a Mosaic of MosaicWindows without crashing", () => {
    const root = createRoot(host);
    act(() => {
      root.render(
        createElement(Mosaic<string>, {
          value: DEFAULT_LAYOUT,
          onChange: () => {},
          renderTile: (id, path) =>
            createElement(
              MosaicWindow<string>,
              { path, title: id },
              createElement("div", null, id),
            ),
        }),
      );
    });
    expect(host.querySelector(".mosaic")).toBeTruthy();
    act(() => root.unmount());
  });
});
