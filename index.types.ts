import { ElementHandle } from "puppeteer-core";

export interface ItemMeta {
    name: string;
    url: string;
    quantity: string;
    price: string;
    addButton: ElementHandle;
}

export enum AddItemResult {
    Success,
    OutOfStock
}