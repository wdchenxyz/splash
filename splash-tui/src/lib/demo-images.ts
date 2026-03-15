import { existsSync, readdirSync } from "fs"
import path from "path"

export const DEMO_IMAGE_DIR = path.resolve(import.meta.dir, "../../../img_dir")
export const DEMO_IMAGE_DIR_NAME = path.basename(DEMO_IMAGE_DIR)

export const DEMO_IMAGE_FILES = existsSync(DEMO_IMAGE_DIR)
  ? readdirSync(DEMO_IMAGE_DIR)
      .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name))
      .sort((a, b) => a.localeCompare(b))
  : []

export function getDemoImagePath(fileName: string): string {
  return path.join(DEMO_IMAGE_DIR, fileName)
}
