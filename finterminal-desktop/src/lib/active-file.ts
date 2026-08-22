export type FileCapabilities = {
  chart: boolean
  report: boolean
  statistics: boolean
  chain: boolean
}

export type ActiveFile = {
  path: string
  detection: string
  capabilities: FileCapabilities
}

const DATA_FILE = /\.(csv|tsv|xlsx|xls|json|parquet)$/i
const TEXT_FILE = /\.(txt|md|pdf|docx?|csv|tsv|xlsx|xls|json)$/i

/** 根据文件格式先给出可用能力，后端体检结果仍会在面板内展示。 */
export function capabilitiesForFile(path: string): FileCapabilities {
  const data = DATA_FILE.test(path)
  return { chart: data, statistics: data, report: TEXT_FILE.test(path) || data, chain: true }
}