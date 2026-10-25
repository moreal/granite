import { test, expect, type Locator } from "@playwright/test";
import { demo, editor, body, paste, saved, create } from "../helpers/ui";

async function effectiveOpacity(locator: Locator) {
  return locator.evaluate((element) => {
    let opacity = 1;
    for (let node: Element | null = element; node; node = node.parentElement)
      opacity *= Number(getComputedStyle(node).opacity);
    return opacity;
  });
}

test("S04/S10/S12: writing subdues only chrome and restores keyboard/pointer access", async ({
  page,
}) => {
  await demo(page);
  const chrome = page.locator(".sidebar");
  await expect(chrome).toHaveCSS("opacity", "1");
  await body(page, "조용히 쓰는 본문");
  await expect(chrome).toHaveCSS("opacity", "0.3");
  for (const selector of [
    ".topbar",
    ".connections",
    ".note-meta",
    ".editor-hint",
  ])
    await expect(page.locator(selector)).toHaveCSS("opacity", "0.3");
  for (const selector of [".save-state", "h1", ".cm-content"])
    expect(await effectiveOpacity(page.locator(selector))).toBe(1);
  await saved(page);
  await expect(chrome).toHaveCSS("opacity", "0.3");
  await page.screenshot({
    path: "docs/screenshots/typing-desktop-writing.png",
  });
  await page.keyboard.press("ArrowLeft");
  await expect(chrome).toHaveCSS("opacity", "0.3");
  await page.keyboard.press("Tab");
  await expect(chrome).toHaveCSS("opacity", "1");
  await expect(chrome).toHaveCSS("transition-duration", "0s");
  await page.screenshot({
    path: "docs/screenshots/typing-desktop-revealed.png",
  });
  await editor(page).focus();
  await page.keyboard.insertText(" 추가");
  await expect(chrome).toHaveCSS("opacity", "0.3");
  await page.mouse.move(15, 15);
  await expect(chrome).toHaveCSS("opacity", "1");
  await page.getByRole("textbox", { name: "노트 검색" }).fill("본문");
  await expect(chrome).toHaveCSS("opacity", "1");
});

test("S04/S08/S12: selection, menus, reduced motion and manual focus remain usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await demo(page);
  const chrome = page.locator(".topbar");
  await body(page, "선택할 내용");
  await expect(chrome).toHaveCSS("opacity", "0.3");
  await expect(chrome).toHaveCSS("transition-duration", "0s");
  await page.screenshot({ path: "docs/screenshots/typing-reduced-motion.png" });
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(chrome).toHaveCSS("opacity", "1");
  await page.keyboard.press("ArrowRight");
  await paste(page, "https://example.com/");
  await expect(
    page.getByRole("group", { name: "붙여넣은 링크" }),
  ).toBeVisible();
  expect(await effectiveOpacity(page.locator(".paste-menu"))).toBe(1);
  await expect(chrome).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "집중 모드", exact: true }).click();
  await editor(page).focus();
  await page.keyboard.insertText(" 계속");
  await expect(chrome).toHaveCSS("opacity", "0.3");
  await page.setViewportSize({ width: 760, height: 900 });
  await page.screenshot({ path: "docs/screenshots/typing-narrow-writing.png" });
  await page.keyboard.press("Escape");
  await expect(chrome).toHaveCSS("opacity", "1");
  await expect(page.locator(".sidebar")).toBeHidden();
  await page.screenshot({
    path: "docs/screenshots/typing-narrow-revealed.png",
  });
});

test("S04/S06/S10/S12: edits, commands, autocomplete and note loads preserve chrome intent", async ({
  page,
}) => {
  await demo(page);
  const chrome = page.locator(".topbar");
  await create(page, "입력 흐림");
  await body(page, "가나다");
  await expect(chrome).toHaveCSS("opacity", "0.3");
  await expect(chrome).toHaveCSS("transition-duration", "0.25s");
  await expect(chrome).toHaveCSS("transition-timing-function", "ease-out");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");
  await expect(chrome).toHaveCSS("opacity", "0.3");
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(chrome).toHaveCSS("opacity", "0.3");
  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(chrome).toHaveCSS("opacity", "0.3");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(chrome).toHaveCSS("opacity", "1");
  await saved(page);
  await expect(chrome).toHaveCSS("opacity", "1");
  await page.keyboard.insertText(" [[");
  await expect(page.locator(".cm-tooltip-autocomplete")).toBeVisible();
  await expect(chrome).toHaveCSS("opacity", "0.3");
  expect(await effectiveOpacity(page.locator(".cm-tooltip-autocomplete"))).toBe(
    1,
  );
  await page.keyboard.press("Escape");
  await expect(chrome).toHaveCSS("opacity", "1");
  const cdp = await page.context().newCDPSession(page);
  for (const text of ["ㅎ", "하", "한"]) {
    await cdp.send("Input.imeSetComposition", {
      text,
      selectionStart: text.length,
      selectionEnd: text.length,
    });
  }
  await cdp.send("Input.insertText", { text: "한" });
  await expect(chrome).toHaveCSS("opacity", "0.3");
  await expect(editor(page)).toContainText("한");
  await page.getByRole("button", { name: "새 노트", exact: true }).focus();
  await expect(chrome).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  expect(await effectiveOpacity(page.getByRole("dialog"))).toBe(1);
  await expect(chrome).toHaveCSS("opacity", "1");
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "빠른 노트" })
    .getByRole("button", { name: "덤프", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "덤프", exact: true }),
  ).toBeVisible();
  await expect(chrome).toHaveCSS("opacity", "1");
});

test("S10/S12: save errors and recovered drafts keep full effective opacity while writing", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "granite.demo.v1" && sessionStorage.getItem("fail-demo-save"))
        throw new DOMException("검증용 저장 실패", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await demo(page);
  await page.evaluate(() => sessionStorage.setItem("fail-demo-save", "true"));
  await body(page, "보존해야 하는 한글 초안");
  await expect(page.locator(".save-error")).toBeVisible();
  await expect(page.locator(".topbar")).toHaveCSS("opacity", "0.3");
  for (const selector of [".save-state", ".save-error", ".recovery-actions"])
    expect(await effectiveOpacity(page.locator(selector))).toBe(1);
  await page.reload();
  await expect(page.locator(".draft-notice")).toBeVisible();
  await editor(page).focus();
  await page.keyboard.insertText("복구 후에도 ");
  await expect(page.locator(".topbar")).toHaveCSS("opacity", "0.3");
  for (const selector of [".draft-notice", ".save-state"])
    expect(await effectiveOpacity(page.locator(selector))).toBe(1);
  await expect(page.locator(".save-error")).toBeVisible();
  expect(
    await effectiveOpacity(
      page.getByRole("button", { name: "다시 저장", exact: true }),
    ),
  ).toBe(1);
  await page.screenshot({ path: "docs/screenshots/typing-recovery.png" });
});

for (const { label, input, option, mouse } of [
  { label: "existing note mouse", input: "[[덤", option: /덤프/, mouse: true },
  { label: "existing note Enter", input: "[[덤", option: /덤프/, mouse: false },
  {
    label: "today command Enter",
    input: "@오늘",
    option: /^오늘/,
    mouse: false,
  },
  {
    label: "new wiki Enter",
    input: "[[새연결",
    option: /새연결/,
    mouse: false,
  },
]) {
  test(`S06/S07/S12: completion ${label} reveals chrome until ordinary typing resumes`, async ({
    page,
  }) => {
    await demo(page);
    await body(page, "");
    await editor(page).pressSequentially(input);
    const choice = page.getByRole("option", { name: option });
    await expect(choice).toBeVisible();
    await expect(page.locator(".topbar")).toHaveCSS("opacity", "0.3");
    if (mouse) await choice.click();
    else await editor(page).press("Enter");
    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(page.locator(".topbar")).toHaveCSS("opacity", "1");
    await expect(page.locator(".topbar")).toHaveCSS(
      "transition-duration",
      "0s",
    );
    await page.keyboard.insertText(" 이어 쓰기");
    await expect(page.locator(".topbar")).toHaveCSS("opacity", "0.3");
  });
}

// Keep Date.now fixed while timers still run: Enter is guaranteed to arrive
// inside CodeMirror's default interaction delay, independent of machine speed.
test("S06/S12: a visible explicit completion accepts immediate Enter", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-24T12:00:00+09:00"));
  await demo(page);
  await body(page, "");
  await editor(page).pressSequentially("[[덤");
  await expect(page.getByRole("option", { name: /덤프/ })).toBeVisible();
  await editor(page).press("Enter");
  await expect(editor(page)).toHaveText("[[덤프]]");
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(page.locator(".topbar")).toHaveCSS("opacity", "1");
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`S04/S12: pointer reveal renders a short interruptible fade (${reducedMotion})`, async ({
    page,
  }, testInfo) => {
    await page.emulateMedia({ reducedMotion });
    await demo(page);
    await body(page, "포인터 복원 전환 검증");
    const chrome = page.locator(".topbar");
    await expect(chrome).toHaveCSS("opacity", "0.3");
    // Capture the browser's real transition before automation latency can finish it.
    await chrome.evaluate((element) => {
      element.addEventListener(
        "transitionrun",
        () => {
          const animation = element.getAnimations()[0];
          animation.pause();
          animation.currentTime = 60;
        },
        { once: true },
      );
    });
    await page.mouse.move(12, 12);
    if (reducedMotion === "reduce") {
      await expect(chrome).toHaveCSS("opacity", "1");
      expect(
        await chrome.evaluate((element) => element.getAnimations().length),
      ).toBe(0);
    } else {
      await expect
        .poll(() =>
          chrome.evaluate((element) => {
            const animation = element.getAnimations()[0];
            return (
              animation?.playState === "paused" && animation.currentTime === 60
            );
          }),
        )
        .toBe(true);
      const frame = await chrome.evaluate((element) => ({
        opacity: Number(getComputedStyle(element).opacity),
        duration: element.getAnimations()[0].effect!.getTiming().duration,
      }));
      expect(frame.duration).toBe(120);
      expect(frame.opacity).toBeGreaterThan(0.3);
      expect(frame.opacity).toBeLessThan(1);
      await page.mouse.move(16, 16);
      expect(
        await chrome.evaluate((element) =>
          Number(getComputedStyle(element).opacity),
        ),
      ).toBe(frame.opacity);
      expect(await effectiveOpacity(page.locator(".save-state"))).toBe(1);
      await page.screenshot({
        path: testInfo.outputPath("pointer-midpoint.png"),
      });
      // Re-typing reverses from the rendered frame rather than snapping to an endpoint.
      await page.keyboard.insertText(" 계속");
      const reversed = await chrome.evaluate((element) =>
        Number(getComputedStyle(element).opacity),
      );
      expect(reversed).toBeGreaterThan(0.3);
      expect(reversed).toBeLessThan(1);
      await expect(chrome).toHaveCSS("opacity", "0.3");
      await page.mouse.move(20, 20);
      await expect(chrome).toHaveCSS("opacity", "1");
    }
    await page.setViewportSize({ width: 760, height: 900 });
    await page.screenshot({
      path: testInfo.outputPath("pointer-narrow-revealed.png"),
    });
    await page.keyboard.insertText(" 다시");
    await expect(chrome).toHaveCSS("opacity", "0.3");
    await page.keyboard.press("Tab");
    await expect(chrome).toHaveCSS("opacity", "1");
    expect(
      await chrome.evaluate((element) => element.getAnimations().length),
    ).toBe(0);
  });
}
