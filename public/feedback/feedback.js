const releaseVersion = '0.2.2'
const copy = {
  zh: {
    language: '语言', title: '反馈中心',
    lead: '遇到问题，或有新的想法？把使用情况告诉我们，一起把 OWBT 做得更好。',
    communityTag: '交流与使用帮助', communityTitle: '加入 QQ 社区群',
    communityBody: '使用咨询、问题反馈与功能建议，都可以在群内交流。',
    groupLabel: 'QQ群号', copyGroup: '复制群号', joinHint: '打开 QQ → 搜索群号 → 申请加入。',
    reportTag: '让问题更容易复现', reportTitle: '准备一份反馈',
    reportBody: '复制模板，补充复现步骤与相关截图，再发送到 QQ 群或 GitHub Issues。',
    templateLabel: '反馈模板 · 可直接编辑', copyTemplate: '复制反馈模板', github: '前往 GitHub Issues',
    templateHint: '本页不提交反馈。请把填好的模板发到所选渠道；截图请附在消息或 Issue 中。',
    helpTitle: '先看看使用教程', helpBody: 'OBS 接入、对阵包导入、项目备份与恢复，都有图文步骤和练习素材。',
    guide: '打开中文上手教程', return: '返回 OWBT', copied: '已复制', manual: '请在已选中的文本框中按 Ctrl+C（Mac：⌘C）手动复制。',
    template: (origin) => `问题 / 建议：\nOWBT 版本：v${releaseVersion}\n使用站点：${origin}\n使用环境：普通浏览器 / OBS 停靠窗口\n浏览器 / OBS 版本：\n复现步骤：\n1. \n预期结果：\n实际结果：\n若为 OCR 问题：\n截图分辨率 / 比例：\n威能布局：无威能 / 单威能 / 双威能\n截图来源：游戏原图 / 经聊天软件压缩\n出错阶段：引擎加载 / 裁切 / 数字 / 时长 / 选手对应 / 应用\n页面状态或错误文字：\n使用的裁切设置：\n相关截图：请另附原图与裁切预览（可遮盖个人信息）`
  },
  en: {
    language: 'Language', title: 'Feedback Center',
    lead: 'Found an issue or have an idea? Tell us about your experience and help improve OWBT.',
    communityTag: 'Community & help', communityTitle: 'Join the QQ community',
    communityBody: 'Ask questions, report problems, and suggest features in the community group.',
    groupLabel: 'QQ group number', copyGroup: 'Copy Group Number', joinHint: 'Open QQ, search for the group number, and request to join.',
    reportTag: 'Help us reproduce the issue', reportTitle: 'Prepare your feedback',
    reportBody: 'Copy the template, add steps and screenshots, then send it to the QQ group or GitHub Issues.',
    templateLabel: 'Feedback template · editable', copyTemplate: 'Copy Feedback Template', github: 'Open GitHub Issues',
    templateHint: 'This page does not submit feedback. Send the completed template through your chosen channel and attach screenshots there.',
    helpTitle: 'Check the quick-start guide', helpBody: 'Follow illustrated steps for OBS, match packages, backups, and recovery with practice assets.',
    guide: 'Open Guide (Chinese)', return: 'Back to OWBT', copied: 'Copied', manual: 'Press Ctrl+C (Mac: ⌘C) in the selected field to copy manually.',
    template: (origin) => `Issue / suggestion:\nOWBT version: v${releaseVersion}\nWebsite: ${origin}\nEnvironment: browser / OBS dock\nBrowser / OBS version:\nSteps to reproduce:\n1. \nExpected result:\nActual result:\nFor OCR issues:\nScreenshot resolution / aspect:\nPerks: none / one / two\nScreenshot source: game original / compressed by chat software\nFailure stage: engine loading / crop / numbers / time / players / Apply\nPage status or error message:\nCrop settings used:\nScreenshots: attach original and crop previews separately (redact personal information if needed)`
  }
}

const language = document.getElementById('language')
const template = document.getElementById('report-template')
let templateEdited = false
let copyAttempt = 0
language.value = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh'

const renderLanguage = () => {
  const text = copy[language.value]
  document.documentElement.lang = language.value === 'zh' ? 'zh-CN' : 'en'
  document.title = `OWBT ${text.title}`
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = text[element.dataset.i18n]
  })
  if (!templateEdited) template.value = text.template(location.origin)
  document.querySelectorAll('.status').forEach(element => { element.textContent = '' })
  copyAttempt += 1
}
template.addEventListener('input', () => { templateEdited = true })
language.addEventListener('change', renderLanguage)
renderLanguage()

document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    const field = document.getElementById(button.dataset.copy)
    const status = document.getElementById(`${button.dataset.copy}-status`)
    const text = copy[language.value]
    const attempt = ++copyAttempt
    field.focus()
    field.select()
    status.textContent = text.manual
    if (!navigator.clipboard?.writeText) return
    let timer
    try {
      const success = await Promise.race([
        navigator.clipboard.writeText(field.value).then(() => true),
        new Promise(resolve => { timer = window.setTimeout(() => resolve(false), 1200) })
      ])
      if (success && attempt === copyAttempt) status.textContent = text.copied
    } catch {
      // Keep the selected text and manual-copy instruction available in OBS.
    } finally {
      window.clearTimeout(timer)
    }
  })
})
