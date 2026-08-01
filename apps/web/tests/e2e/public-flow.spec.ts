import { expect, test } from "@playwright/test";

test("la portada conduce al registro sin desplazamiento horizontal", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Lo importante de casa/i }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("html").evaluate((element) => element.clientWidth),
  );
  await page.getByRole("link", { name: "Organizar mi hogar" }).click();
  await expect(
    page.getByRole("heading", { name: "Crea tu cuenta" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar con Apple" }),
  ).toBeVisible();
});

test("el formulario de acceso muestra sus controles esenciales", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continuar con Apple" }),
  ).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.getByLabel("Contraseña")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión" }),
  ).toBeVisible();
});
