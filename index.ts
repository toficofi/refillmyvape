import puppeteer, { ElementHandle, Page } from 'puppeteer-core';
import { AddItemResult, ItemMeta } from './index.types';

const itemUrls = [
    // In order of preference, the choices we can pick from
    "https://refillstation.online/products/bronx-mango-tang-with-free-nicotine-shot",
    "https://refillstation.online/products/bronx-fruit-bowl-with-free-nicotine-shot",
    "https://refillstation.online/products/bronx-papaya-pop-with-free-nicotine-shot",
    "https://refillstation.online/products/bronx-grape-soda-with-free-nicotine-shot",
    "https://refillstation.online/products/ozo-mango-melon-passion-fruit-with-free-nicotine-shot-1",
    "https://refillstation.online/products/bronx-twister-with-free-nicotine-shot"
]

const TARGET_COUNT = 5

const AGE_PROMPT_SELECTOR = ".preview_box .agree_btn"
const PURCHASE_BUTTON_SELECTOR = ".purchase-details__buttons .add_to_cart"
const TITLE_SELECTOR = ".product-block .product_name"

const main = async () => {
    console.log("⌛ Starting up... there are " + itemUrls.length + " items to try")

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    });

    const page = await browser.newPage();
    await page.setViewport({width: 1920, height: 1080});

    let itemsInBasketCount = 0
    let itemUrlIndex = 0

    while (itemsInBasketCount < TARGET_COUNT) {
        if (itemUrlIndex >= itemUrls.length) {
            break
        }

        const itemUrl = itemUrls[itemUrlIndex]

        try { 
            const result = await addItemToCart(page, itemUrl)

            if (result === AddItemResult.Success) {
                itemsInBasketCount++
            }
        } catch (e) {
            console.log("❌ Failed to add item to cart due to an error " + e)
        }

        itemUrlIndex++
    }

    if (itemsInBasketCount === 0) {
        console.log("☹️ Couldn't add any items to the basket")
        return
    }

    await page.goto("https://refillstation.online/cart", { waitUntil: 'networkidle2' })

    let itemsInBasket = await readBasket(page)

    if (itemsInBasketCount < TARGET_COUNT) {
        console.log("🫗 Only " + itemsInBasketCount + "/" + TARGET_COUNT + " items added to the basket, duplicating one...")
    

        for (let i = 0; i < TARGET_COUNT - itemsInBasketCount; i++) {
            itemsInBasket = await readBasket(page)
            const mostPreferredItem = itemsInBasket[0]

            await mostPreferredItem.addButton.click()
            await page.waitForNavigation()
        }
    }

    console.log("🎉 Done! " + itemsInBasketCount + " items added to the basket")

    itemsInBasket = await readBasket(page, true)
    printBasket(itemsInBasket)

    browser.disconnect()
}

const printBasket = async (itemMetas: ItemMeta[]) => {
    console.log("\n=====================")
    itemMetas.forEach(item => {
        console.log(" - " + item.name + " x" + item.quantity + " @ " + item.price)
    })
    console.log("=====================\n")
}

const readBasket = async (page: Page, forceNavigation = false): Promise<ItemMeta[]> => {
    if (forceNavigation || page.url() !== "https://refillstation.online/cart") {
        await page.goto("https://refillstation.online/cart", { waitUntil: 'networkidle2' })
    }

    const items = await page.$$(".cart__item")

    const itemMetas = await Promise.all(items.map(async item => {
        const addButton = await item.$(".product-plus.js-change-quantity") as ElementHandle
        const name = await item.$eval(".cart__item--title a", el => el.textContent!.trim())
        const url = await item.$eval(".cart__item--title a", el => el.getAttribute("href")!)
        const quantity = await item.$eval(".product-quantity-box .quantity", el => el.getAttribute("value")!)
        const price = await item.$eval(".modal_price .money", el => el.textContent!.trim())

        return {
            name,
            url,
            quantity,
            price,
            addButton
        }
    }))

    return itemMetas
}

const addItemToCart = async (page: Page, url: string): Promise<AddItemResult> => {
    await page.goto(url, { waitUntil: 'networkidle2' })

    // Accept age prompt, if it exists
    const agePromptExists = await page.$(AGE_PROMPT_SELECTOR) !== null
    if (agePromptExists) {
        await page.click(AGE_PROMPT_SELECTOR)
        await new Promise(resolve => setTimeout(resolve, 2000))
    }

    // Get title by queryselector
    const title = await page.$eval(TITLE_SELECTOR, el => el.textContent)
    
    const isOutOfStock = await page.$eval(PURCHASE_BUTTON_SELECTOR, el => {
        return el.getAttribute("disabled") === "disabled"
    })

    if (isOutOfStock) {
        console.log("❌ " + title + " is out of stock")
        return AddItemResult.OutOfStock
    } 

    await page.click(PURCHASE_BUTTON_SELECTOR)

    await new Promise(resolve => setTimeout(resolve, 2000))

    console.log("✅ " + title + " added to basket")
    return AddItemResult.Success
}
main()