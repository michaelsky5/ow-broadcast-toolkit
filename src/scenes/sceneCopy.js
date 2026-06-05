const SCENE_COPY = {
  zh: {
    scenes: {
      matchup: { name: '下场预告', meta: '下场预告' },
      'live-hud': { name: '直播实况', meta: '直播控制' },
      'current-map': { name: '地图设置', meta: '地图流程' },
      roster: { name: '队伍阵容', meta: '阵容' },
      stats: { name: '比赛数据', meta: '数据面板' },
      casters: { name: '解说席位', meta: '解说' },
      countdown: { name: '中场休息', meta: '待机倒计时' },
      media: { name: '媒体播放', meta: '素材播放' },
      'team-data': { name: '选手数据', meta: '选手对比' },
      mvp: { name: '最佳选手', meta: '最佳表现' },
      'starting-five': { name: '首发名单', meta: '阵容展示' },
      pause: { name: '技术暂停', meta: '比赛暂停' },
      result: { name: '赛果总结', meta: '赛后包装' },
      thanks: { name: '结束致谢', meta: '收尾包装' }
    },
    bundles: {
      'data-center': { label: '数据中心', description: '比赛 / 选手' },
      'break-desk': { label: '中场控制', description: '中场休息 / 技术暂停' },
      'show-flow': { label: '流程包装', description: '下场预告 / 首发名单 / 赛果总结' }
    }
  },
  en: {
    scenes: {
      matchup: { name: 'Up Next', meta: 'Show Flow' },
      'live-hud': { name: 'Live', meta: 'Live HUD' },
      'current-map': { name: 'Map Setup', meta: 'Match Control' },
      roster: { name: 'Team Roster', meta: 'Roster' },
      stats: { name: 'Match Stats', meta: 'Data Center' },
      casters: { name: 'Caster Desk', meta: 'Talent' },
      countdown: { name: 'Break', meta: 'Standby' },
      media: { name: 'Media', meta: 'Media' },
      'team-data': { name: 'Player Data', meta: 'Data Center' },
      mvp: { name: 'MVP', meta: 'Data Center' },
      'starting-five': { name: 'Starting Five', meta: 'Lineup' },
      pause: { name: 'Technical Pause', meta: 'Break Desk' },
      result: { name: 'Result', meta: 'Post-match' },
      thanks: { name: 'Thanks', meta: 'Closing' }
    },
    bundles: {
      'data-center': { label: 'Data Center', description: 'Team / Player' },
      'break-desk': { label: 'Break Desk', description: 'Standby / Countdown / Pause' },
      'show-flow': { label: 'Show Flow', description: 'Up Next / Lineup / Result / Thanks' }
    }
  }
}

const getSceneCopy = language => SCENE_COPY[language] || SCENE_COPY.en

const getSceneDisplay = (scene, language) => {
  const copy = getSceneCopy(language).scenes[scene?.id] || SCENE_COPY.en.scenes[scene?.id]
  return {
    name: copy?.name || scene?.enName || scene?.name || scene?.id || '',
    meta: copy?.meta || scene?.category || scene?.enName || scene?.id || ''
  }
}

const getBundleDisplay = (bundle, language) => {
  const copy = getSceneCopy(language).bundles[bundle?.id] || SCENE_COPY.en.bundles[bundle?.id]
  return {
    label: copy?.label || bundle?.label || bundle?.id || '',
    description: copy?.description || bundle?.description || ''
  }
}

export { getBundleDisplay, getSceneCopy, getSceneDisplay }
