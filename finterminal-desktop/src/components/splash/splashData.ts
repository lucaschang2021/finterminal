/**
 * Splash 数据：实测菱形环带边界 + 流动色板。
 * R_IN48 / R_OUT48 为从品牌图标中提取的环带内/外轮廓（48 点半径，viewBox 单位）。
 */

export const R_IN48 = [
  232.7, 217.2, 198.7, 186.6, 179.2, 172.2, 174.4, 176.2, 180.7, 187.9, 200.7, 219.2,
  232.0, 218.4, 200.8, 188.0, 179.6, 174.9, 173.3, 175.8, 180.6, 188.3, 201.2, 219.8,
  232.6, 215.1, 198.6, 186.4, 178.9, 174.2, 173.4, 173.3, 178.4, 187.4, 199.0, 218.0,
  228.9, 219.2, 202.3, 189.8, 182.4, 177.6, 175.7, 177.1, 181.9, 190.0, 200.2, 217.4,
]

export const R_OUT48 = [
  373.9, 368.3, 358.4, 340.9, 327.6, 317.4, 315.6, 317.6, 325.8, 340.3, 362.4, 380.2,
  384.8, 378.3, 360.1, 336.8, 323.0, 314.1, 311.7, 313.1, 322.9, 334.3, 351.1, 366.3,
  373.1, 370.3, 357.8, 338.3, 323.6, 316.0, 314.1, 316.9, 325.9, 341.0, 363.2, 382.8,
  388.6, 383.6, 365.0, 342.1, 326.6, 318.3, 315.7, 317.4, 325.6, 339.3, 359.8, 371.0,
]

/**
 * 环带边界：
 * - R_IN_WIDE：内缘内收 15%，确保彩色完全覆盖环带内侧，任何角度都不留缺口
 * - R_OUT_CLIP：外缘外扩 4% 的裁剪多边形，确保裁剪永不削到环带外侧顶点
 */
export const R_IN_WIDE = R_IN48.map((v) => v * 0.85)
export const R_OUT_CLIP = R_OUT48.map((v) => v * 1.04)

/** 色相连续排列，环流过渡顺滑 */
export const FLOW_PAL = [
  '#3E7BC0', '#3BA9C0', '#62C491', '#B7B36F',
  '#FCB05A', '#EF6A55', '#9340A4', '#6547C9',
]

const palRgb = FLOW_PAL.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
])

export function interpR(th: number, R: number[]): number {
  const p = th / (Math.PI * 2) * 48
  const i0 = Math.floor(p) % 48
  const f = p - Math.floor(p)
  return R[i0] + (R[(i0 + 1) % 48] - R[i0]) * f
}

/** 环上位置 p∈[0,1) 对应的平滑插值色 */
export function colorAt(p: number): string {
  const q = (((p % 1) + 1) % 1) * 8
  const i0 = Math.floor(q)
  const f = q - i0
  const ff = f * f * (3 - 2 * f)
  const a = palRgb[i0 % 8]
  const b = palRgb[(i0 + 1) % 8]
  const m = (x: number, y: number) => Math.round(x + (y - x) * ff)
  return `rgb(${m(a[0], b[0])},${m(a[1], b[1])},${m(a[2], b[2])})`
}
