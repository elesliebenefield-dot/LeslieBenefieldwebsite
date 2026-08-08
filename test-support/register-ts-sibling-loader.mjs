import { register } from 'node:module'

register('./ts-sibling-loader.mjs', import.meta.url)
