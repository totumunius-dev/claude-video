import { afterEach, beforeEach } from "vitest";
import { clock } from "../src/core/clock";
import { resetPreviewData } from "../src/state/resetAll";

beforeEach(() => {
  clock.speed = 0;
  localStorage.clear();
  resetPreviewData();
});

afterEach(() => {
  localStorage.clear();
});
