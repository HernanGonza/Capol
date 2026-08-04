import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:8099/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const acceptBtn = page.getByRole("button", { name: "Aceptar" });
if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) await acceptBtn.click();
await page.waitForTimeout(300);

const card = page.locator("h3", { hasText: "Marketing Digital" }).locator("xpath=ancestor::*[contains(@class,'reveal-card')]").first();
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await card.screenshot({ path: "/tmp/ribbon-card-desktop.png" });

const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mobile.goto("http://localhost:8099/", { waitUntil: "networkidle" });
await mobile.waitForTimeout(1500);
const acceptBtn2 = mobile.getByRole("button", { name: "Aceptar" });
if (await acceptBtn2.isVisible({ timeout: 3000 }).catch(() => false)) await acceptBtn2.click();
await mobile.waitForTimeout(300);
const cardMobile = mobile.locator("h3", { hasText: "Marketing Digital" }).locator("xpath=ancestor::*[contains(@class,'reveal-card')]").first();
await cardMobile.scrollIntoViewIfNeeded();
await mobile.waitForTimeout(500);
await cardMobile.screenshot({ path: "/tmp/ribbon-card-mobile.png" });

await browser.close();
console.log("done");
