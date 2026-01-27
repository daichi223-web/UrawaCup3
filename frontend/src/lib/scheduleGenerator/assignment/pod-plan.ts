// src/lib/scheduleGenerator/assignment/pod-plan.ts
/**
 * Pod Plan 計算（3/4/5チームのPod構成）
 */

import type { PodPlan } from '../types'

/**
 * N（チーム数）とV（会場数）からPodPlanを計算
 * 解がない場合はエラーをスロー
 *
 * 条件: 3a + 4b + 5c = N, a + b + c = V
 *
 * 例: N=24, V=6 → 4×6=24 (a=0, b=6, c=0)
 * 例: N=20, V=5 → 4×5=20 (a=0, b=5, c=0)
 * 例: N=19, V=5 → 3×1 + 4×4=19 (a=1, b=4, c=0)
 */
export function computePodPlanOrThrow(N: number, V: number): PodPlan {
  // 全探索（V <= 10程度なので問題なし）
  for (let a = 0; a <= V; a++) {
    for (let c = 0; c <= V - a; c++) {
      const b = V - a - c
      if (b < 0) continue

      const sum = 3 * a + 4 * b + 5 * c
      if (sum === N) {
        return {
          pod3Count: a,
          pod4Count: b,
          pod5Count: c,
          totalVenues: V,
          totalTeams: N,
        }
      }
    }
  }

  throw new Error(`PodPlan計算失敗: N=${N}, V=${V} の組み合わせに解がありません`)
}

/**
 * PodPlanから各会場のPodサイズ配列を生成
 * 例: {pod3Count: 1, pod4Count: 4, pod5Count: 0} → [3, 4, 4, 4, 4]
 */
export function getPodSizes(plan: PodPlan): number[] {
  const sizes: number[] = []
  for (let i = 0; i < plan.pod3Count; i++) sizes.push(3)
  for (let i = 0; i < plan.pod4Count; i++) sizes.push(4)
  for (let i = 0; i < plan.pod5Count; i++) sizes.push(5)
  return sizes
}
