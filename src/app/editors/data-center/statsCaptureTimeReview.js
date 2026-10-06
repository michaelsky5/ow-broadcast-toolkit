import { parseMatchTimeOcr } from './statsCaptureUtils.js'
import { STAT_FIELDS } from './statsCaptureReview.js'

export const selectMatchTimeOcrCandidates = (rawCandidates = [], isolatedTimeIndex = -1) => {
  const candidates = rawCandidates.map(candidate => {
    const rawText = String(candidate.rawText || '').trim()
    const parsedTime = parseMatchTimeOcr(rawText)
    const confidence = Number(candidate.confidence) || 0
    // A literal colon is stronger evidence than punctuation repaired into one.
    const separatorScore = /\d\s*[:：]\s*\d/u.test(rawText) ? 80
      : /\d\s*[.,;]\s*\d/u.test(rawText) ? 60 : 0
    const score = (parsedTime ? 200 : -200) + separatorScore + confidence * 0.25
      + (candidate.pageSegMode === '7' ? 3 : 0)
    return { ...candidate, rawText, parsedTime, confidence, score }
  })
  const byScore = (left, right) => right.score - left.score
  const bestByImage = new Map()
  candidates.forEach(candidate => {
    const previous = bestByImage.get(candidate.candidateIndex)
    if (!previous || candidate.score > previous.score) bestByImage.set(candidate.candidateIndex, candidate)
  })
  const votes = new Map()
  bestByImage.forEach(candidate => {
    if (!candidate.parsedTime) return
    votes.set(candidate.parsedTime, (votes.get(candidate.parsedTime) || 0) + 1)
  })
  const scoreForTime = time => Math.max(...candidates.filter(candidate => candidate.parsedTime === time).map(candidate => candidate.score))
  const rankedVotes = [...votes.entries()]
    .sort((left, right) => right[1] - left[1] || scoreForTime(right[0]) - scoreForTime(left[0]))
  const [votedTime = '', voteCount = 0] = rankedVotes[0] || []
  const runnerUpCount = rankedVotes[1]?.[1] || 0
  const bestCandidate = candidates.filter(candidate => candidate.parsedTime === votedTime && votedTime).sort(byScore)[0]
  const isolatedModeVoteCount = votedTime && isolatedTimeIndex >= 0
    ? new Set(candidates.filter(candidate => (
        candidate.candidateIndex === isolatedTimeIndex && candidate.parsedTime === votedTime
      )).map(candidate => candidate.pageSegMode)).size
    : 0
  const hasPreprocessingConsensus = Boolean(votedTime && voteCount >= 2 && voteCount > runnerUpCount)
  const hasStrongIsolatedConsensus = Boolean(
    bestCandidate?.candidateIndex === isolatedTimeIndex
    && isolatedModeVoteCount >= 2
    && Number(bestCandidate.confidence) >= 55
    && runnerUpCount === 0
  )

  return {
    value: votedTime,
    confidence: bestCandidate?.confidence || 0,
    voteCount: Math.max(voteCount, hasStrongIsolatedConsensus ? isolatedModeVoteCount : 0),
    candidateCount: bestByImage.size,
    autoApply: hasPreprocessingConsensus || hasStrongIsolatedConsensus,
    isolatedModeVoteCount,
    rawText: bestCandidate?.rawText || '',
    candidates
  }
}

export const applyScoreboardOcrReviewGuard = (numericDiagnostics, timeOcrReview) => {
  const cells = ['teamA', 'teamB'].flatMap(side => (
    (numericDiagnostics?.[side] || []).flatMap(row => STAT_FIELDS.map(field => row[field]))
  ))
  const uncertainCount = cells.filter(cell => !cell?.autoApply).length
  // Widespread disagreement indicates unreliable input even when a few cells
  // repeat the same mistake across variants (for example, compressed screenshots).
  const reviewAll = cells.length > 0 && uncertainCount / cells.length >= 0.2
  if (!reviewAll) return { numericDiagnostics, timeOcrReview, reviewWarning: '' }

  const requireReview = cell => cell ? { ...cell, autoApply: false, reviewReason: 'scoreboard-disagreement' } : cell
  return {
    numericDiagnostics: Object.fromEntries(['teamA', 'teamB'].map(side => [
      side, (numericDiagnostics?.[side] || []).map(row => Object.fromEntries(
        STAT_FIELDS.map(field => [field, requireReview(row[field])])
      ))
    ])),
    timeOcrReview: requireReview(timeOcrReview),
    reviewWarning: '识别分歧较多，请上传原图或逐项核对'
  }
}
