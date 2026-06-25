export const buildLegacyFriesCupExport = project => ({
  supported: false,
  exportedAt: new Date().toISOString(),
  warnings: ['LEGACY_FC_EXPORT_NOT_IMPLEMENTED'],
  editionData: project?.editionData?.friesCup || {}
})

