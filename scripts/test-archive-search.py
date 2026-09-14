#!/usr/bin/env python3
"""Playwright checks for the archive search.

Needs a built site and a preview server:
    npm run build && npx astro preview --port 4325 &
    <playwright-python> scripts/test-archive-search.py [base_url]

There is no Python venv in this repo; the bookcatalog one has Playwright:
    ../bookcatalog/pipeline/.venv/bin/python scripts/test-archive-search.py
"""
import sys
import time

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4325"
results = []


def log(name, ok, detail=""):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")


def open_archive(page, query=""):
    page.goto(f"{BASE}/archive{query}", wait_until="domcontentloaded")
    page.wait_for_selector("#archive-search", timeout=20000)


def rows(page):
    return page.locator("div.mt-6 > article")


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page_errors = []
    same_origin_failures = []
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    page.on("response", lambda r: same_origin_failures.append((r.status, r.url))
            if r.status >= 400 and r.url.startswith(BASE) else None)

    open_archive(page)
    log("search field present", page.locator("#archive-search").count() == 1)
    log("episode list visible before searching", page.locator("#episode-list").is_visible())

    # The headline requirement: one word, every GitHub link in the archive.
    box = page.locator("#archive-search")
    box.click()
    box.type("github", delay=25)
    page.wait_for_selector("div.mt-6 > article", timeout=15000)
    page.wait_for_timeout(600)
    count_text = page.locator("span.ml-auto").inner_text()
    log("github returns the whole archive's links", rows(page).count() > 0, count_text)
    log("episode list hides while searching", not page.locator("#episode-list").is_visible())

    # Only the first page of rows is rendered, and insights outrank repos for
    # this query, so check the totals per tab rather than what happens to show.
    def total_for(tab):
        page.get_by_role("button", name=tab).click()
        page.wait_for_timeout(700)
        return page.locator("span.ml-auto").inner_text()

    repos_for_github = total_for("Repos")
    insights_for_github = total_for("Insights")
    log("github reaches both repos and insights",
        repos_for_github.startswith(tuple("123456789")) and insights_for_github.startswith(tuple("123456789")),
        f"repos: {repos_for_github} / insights: {insights_for_github}")
    page.get_by_role("button", name="Everything").click()
    page.wait_for_timeout(500)

    hosts = page.locator("div.mt-6 > article span.text-gray").all_inner_texts()
    log("rows name the link host", any("github.com" in h for h in hosts))

    # Repo feed across the whole archive, with no query at all.
    page.get_by_role("button", name="Repos").click()
    page.wait_for_timeout(700)
    box.fill("")
    page.wait_for_timeout(800)
    repo_kinds = {t.upper() for t in page.locator("div.mt-6 > article span.uppercase").all_inner_texts()}
    log("Repos tab alone lists repo trends", rows(page).count() > 0 and repo_kinds == {"REPO"},
        page.locator("span.ml-auto").inner_text())

    page.get_by_role("button", name="Insights").click()
    page.wait_for_timeout(800)
    insight_kinds = {t.upper() for t in page.locator("div.mt-6 > article span.uppercase").all_inner_texts()}
    log("Insights tab alone lists insights", rows(page).count() > 0 and insight_kinds == {"INSIGHT"})

    # State lives in the URL, so a search is shareable.
    log("filters are in the URL", "k=i" in page.url, page.url.split("/archive")[-1][:30])

    open_archive(page, "?q=anthropic&k=i")
    page.wait_for_selector("div.mt-6 > article", timeout=15000)
    log("a shared link restores the search", rows(page).count() > 0,
        page.locator("span.ml-auto").inner_text())

    # An insight result has to land on the paragraph it matched.
    href = page.locator("div.mt-6 > article a").first.get_attribute("href")
    log("insight rows deep-link to the paragraph", "#insight-" in (href or ""), href or "no href")
    page.goto(f"{BASE}{href}", wait_until="domcontentloaded")
    anchor = href.split("#")[-1]
    log("that anchor exists on the episode page", page.locator(f"#{anchor}").count() == 1, anchor)

    # A repo that trends for weeks must appear once, not once per episode.
    open_archive(page, "?k=r&q=mattpocock")
    page.wait_for_selector("div.mt-6 > article", timeout=25000)
    page.wait_for_timeout(400)
    titles = page.locator("div.mt-6 > article a").all_inner_texts()
    repeated = [t for t in titles if "mattpocock/skills" in t]
    log("a long-running repo appears once", len(repeated) == 1, f"{len(repeated)} row(s)")
    log("the row says how long it trended", "days trending" in page.content(),
        page.locator("div.mt-6 > article").first.inner_text().replace("\n", " · ")[:72])

    open_archive(page, "?q=rust&k=r")
    page.wait_for_selector("div.mt-6 > article", timeout=15000)
    repo_link = page.locator("div.mt-6 > article a[target=_blank]").first.get_attribute("href")
    log("repo rows link to the repository", "github.com" in (repo_link or ""), repo_link or "no link")

    open_archive(page)
    box = page.locator("#archive-search")
    box.click()
    box.type("zzzqqq", delay=20)
    page.wait_for_timeout(1200)
    log("empty state when nothing matches", "Nothing matches" in page.content())
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    log("Escape clears and brings the list back", page.locator("#episode-list").is_visible())

    open_archive(page)
    box = page.locator("#archive-search")
    box.click()
    started = time.time()
    box.type("model", delay=0)
    page.wait_for_timeout(700)
    log("whole-archive query stays responsive", (time.time() - started) < 3.0, f"{time.time()-started:.2f}s")

    page.set_viewport_size({"width": 390, "height": 844})
    open_archive(page, "?q=github")
    page.wait_for_selector("div.mt-6 > article", timeout=15000)
    log("no horizontal overflow on a phone",
        not page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"))
    page.screenshot(path="/tmp/hub-search-mobile.png")

    page.set_viewport_size({"width": 1280, "height": 900})
    open_archive(page, "?q=github")
    page.wait_for_selector("div.mt-6 > article", timeout=15000)
    page.screenshot(path="/tmp/hub-search-desktop.png")

    # The same search has to work from the home page, hiding today's brief
    # rather than the episode list.
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector("#archive-search", timeout=20000)
    log("home page has the search field", page.locator("#archive-search").count() == 1)
    log("today's brief visible before searching", page.locator("#today-content").is_visible())

    home_box = page.locator("#archive-search")
    home_box.click()
    home_box.type("github", delay=25)
    page.wait_for_selector("div.mt-6 > article", timeout=25000)
    page.wait_for_timeout(600)
    log("home search returns the whole archive", page.locator("div.mt-6 > article").count() > 0,
        page.locator("span.ml-auto").inner_text())
    log("today's brief steps aside for results", not page.locator("#today-content").is_visible())
    log("home search writes its own path", page.url.rstrip("/").endswith("?q=github") or "?q=github" in page.url,
        page.url.replace(BASE, "")[:24])
    page.screenshot(path="/tmp/hub-home-search.png")

    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    log("Escape restores today's brief", page.locator("#today-content").is_visible())

    log("no page errors", not page_errors, "; ".join(page_errors[:2])[:70])
    log("no same-origin request failures", not same_origin_failures, str(same_origin_failures[:2])[:70])
    browser.close()

print(f"\n{sum(results)}/{len(results)} passed")
sys.exit(0 if all(results) else 1)
