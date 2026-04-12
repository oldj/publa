import type { Locator, Page } from '@playwright/test'

function byDataRole(page: Page, role: string): Locator {
  return page.locator(`[data-role="${role}"]`)
}

function fieldInput(page: Page, role: string): Locator {
  return byDataRole(page, role).first()
}

export function adminLogin(page: Page) {
  return {
    form: byDataRole(page, 'admin-login-form'),
    usernameInput: fieldInput(page, 'admin-login-username'),
    passwordInput: fieldInput(page, 'admin-login-password'),
    submitButton: byDataRole(page, 'admin-login-submit'),
  }
}

export function adminShell(page: Page) {
  return {
    dashboardPage: byDataRole(page, 'admin-dashboard-page'),
    dashboardTitle: byDataRole(page, 'admin-dashboard-title'),
    nav: byDataRole(page, 'admin-nav'),
    navGroup: (id: string) => byDataRole(page, `admin-nav-group-${id}`),
    navLink: (id: string) => byDataRole(page, `admin-nav-link-${id}`),
  }
}

export function adminPostsPage(page: Page) {
  return {
    root: byDataRole(page, 'admin-posts-page'),
    title: byDataRole(page, 'admin-posts-page-title'),
    newButton: byDataRole(page, 'admin-posts-new-button'),
  }
}

export function adminPagesPage(page: Page) {
  return {
    root: byDataRole(page, 'admin-pages-page'),
    title: byDataRole(page, 'admin-pages-page-title'),
    newButton: byDataRole(page, 'admin-pages-new-button'),
  }
}

export function postEditor(page: Page) {
  return {
    pageTitle: byDataRole(page, 'post-editor-page-title'),
    backButton: byDataRole(page, 'post-editor-back-button'),
    titleInput: fieldInput(page, 'post-title-input'),
    slugInput: fieldInput(page, 'post-slug-input'),
    historyButton: byDataRole(page, 'post-editor-history-button'),
  }
}

export function pageEditor(page: Page) {
  return {
    pageTitle: byDataRole(page, 'page-editor-page-title'),
    backButton: byDataRole(page, 'page-editor-back-button'),
    titleInput: fieldInput(page, 'page-title-input'),
    pathInput: fieldInput(page, 'page-path-input'),
    templateInput: fieldInput(page, 'page-template-input'),
    historyButton: byDataRole(page, 'page-editor-history-button'),
  }
}
