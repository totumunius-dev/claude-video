import { afterEach, beforeEach } from "vitest";
import { clock } from "../src/core/clock";
import { resetPreviewData } from "../src/state/resetAll";
import { useAI } from "../src/ai/provider";

beforeEach(() => {
  clock.speed = 0;
  localStorage.clear();
  resetPreviewData();
  useAI.getState().set(null, "off");
});

afterEach(() => {
  localStorage.clear();
});
