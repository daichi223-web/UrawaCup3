/**
 * Supabase接続テスト用ページ
 * データ構造の確認・デバッグ用
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SupabaseTest() {
  const [tournament, setTournament] = useState<any>(null)
  const [groups, setGroups] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [standings, setStandings] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState<any>({})

  useEffect(() => {
    async function fetchData() {
      // デバッグ情報を収集
      const debug: any = {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'NOT SET',
        hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
        anonKeyPrefix: import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) || 'NOT SET',
      }
      setDebugInfo(debug)

      try {
        console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL)
        console.log('Anon Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)

        // 大会データを取得
        console.log('Fetching tournaments...')
        const { data: tournamentData, error: tError } = await supabase
          .from('tournaments')
          .select('*')
          .eq('id', 1)
          .single()

        console.log('Tournament response:', { data: tournamentData, error: tError })

        if (tError) {
          console.error('Tournament error:', tError)
          throw new Error(`Tournament: ${tError.message} (${tError.code})`)
        }
        setTournament(tournamentData)

        // グループデータを取得
        console.log('Fetching groups...')
        const { data: groupsData, error: gError } = await supabase
          .from('groups')
          .select('*')
          .eq('tournament_id', 1)
          .order('id')

        console.log('Groups response:', { data: groupsData, error: gError })

        if (gError) {
          console.error('Groups error:', gError)
          throw new Error(`Groups: ${gError.message} (${gError.code})`)
        }
        setGroups(groupsData || [])

        // チームデータを取得（group_id確認用）
        console.log('Fetching teams...')
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('id, name, group_id, tournament_id')
          .eq('tournament_id', 1)
          .order('group_id')
          .order('name')

        console.log('Teams response:', { data: teamsData, error: teamsError })

        if (teamsError) {
          console.error('Teams error:', teamsError)
          throw new Error(`Teams: ${teamsError.message} (${teamsError.code})`)
        }
        setTeams(teamsData || [])

        // 順位表データを取得
        console.log('Fetching standings...')
        const { data: standingsData, error: standingsError } = await supabase
          .from('standings')
          .select('*, team:teams(name)')
          .eq('tournament_id', 1)
          .order('group_id')
          .order('rank')

        console.log('Standings response:', { data: standingsData, error: standingsError })

        if (standingsError) {
          console.error('Standings error:', standingsError)
          throw new Error(`Standings: ${standingsError.message} (${standingsError.code})`)
        }
        setStandings(standingsData || [])

      } catch (err: any) {
        console.error('Catch error:', err)
        const errorMessage = err?.message || err?.toString() || JSON.stringify(err) || '不明なエラー'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg">Supabase接続中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>エラー:</strong> {error}
        </div>
        <div className="bg-gray-100 border border-gray-400 text-gray-700 px-4 py-3 rounded">
          <strong>デバッグ情報:</strong>
          <pre className="mt-2 text-sm">{JSON.stringify(debugInfo, null, 2)}</pre>
          <p className="mt-2 text-sm">ブラウザのコンソール (F12) も確認してください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-green-600">
        ✅ Supabase接続成功！
      </h1>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-bold mb-4">大会情報</h2>
        {tournament && (
          <dl className="space-y-2">
            <div className="flex">
              <dt className="font-medium w-24">ID:</dt>
              <dd>{tournament.id}</dd>
            </div>
            <div className="flex">
              <dt className="font-medium w-24">大会名:</dt>
              <dd>{tournament.name}</dd>
            </div>
            <div className="flex">
              <dt className="font-medium w-24">略称:</dt>
              <dd>{tournament.short_name}</dd>
            </div>
            <div className="flex">
              <dt className="font-medium w-24">開催年:</dt>
              <dd>{tournament.year}</dd>
            </div>
            <div className="flex">
              <dt className="font-medium w-24">期間:</dt>
              <dd>{tournament.start_date} 〜 {tournament.end_date}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">グループ一覧 ({groups.length}件)</h2>
        {groups.length === 0 ? (
          <div className="text-red-600 font-bold">⚠️ groupsテーブルにデータがありません！</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {groups.map(group => (
              <div key={group.id} className="bg-gray-100 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-primary-600">{group.id}</div>
                <div className="text-sm text-gray-600">{group.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* チーム一覧（group_id確認用） */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">チーム一覧 ({teams.length}件) - group_id確認</h2>
        {teams.length === 0 ? (
          <div className="text-red-600 font-bold">⚠️ teamsテーブルにデータがありません！</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">チーム名</th>
                <th className="p-2 text-left">group_id</th>
                <th className="p-2 text-left">group_id型</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(team => (
                <tr key={team.id} className="border-b">
                  <td className="p-2">{team.id}</td>
                  <td className="p-2">{team.name}</td>
                  <td className="p-2 font-mono bg-yellow-100">
                    "{team.group_id}"
                  </td>
                  <td className="p-2 text-gray-500">
                    {typeof team.group_id}
                    {team.group_id === null && ' (NULL)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 順位表データ */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">順位表データ ({standings.length}件)</h2>
        {standings.length === 0 ? (
          <div className="text-orange-600 font-bold">⚠️ standingsテーブルにデータがありません（試合結果入力後に生成されます）</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">group_id</th>
                <th className="p-2 text-left">順位</th>
                <th className="p-2 text-left">チーム</th>
                <th className="p-2 text-left">勝</th>
                <th className="p-2 text-left">敗</th>
                <th className="p-2 text-left">分</th>
                <th className="p-2 text-left">得失点差</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2 font-mono bg-blue-100">"{s.group_id}"</td>
                  <td className="p-2">{s.rank}</td>
                  <td className="p-2">{s.team?.name || `Team ${s.team_id}`}</td>
                  <td className="p-2">{s.won}</td>
                  <td className="p-2">{s.lost}</td>
                  <td className="p-2">{s.drawn}</td>
                  <td className="p-2">{s.goal_difference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* グループとチームの整合性チェック */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold mb-4">データ整合性チェック</h2>
        <div className="space-y-2 text-sm">
          <div>
            <strong>グループID一覧:</strong>
            <span className="ml-2 font-mono bg-gray-100 px-2">
              {groups.map(g => `"${g.id}"`).join(', ') || '(なし)'}
            </span>
          </div>
          <div>
            <strong>チームのgroup_id一覧:</strong>
            <span className="ml-2 font-mono bg-gray-100 px-2">
              {[...new Set(teams.map(t => t.group_id))].map(id => `"${id}"`).join(', ') || '(なし)'}
            </span>
          </div>
          <div>
            <strong>順位表のgroup_id一覧:</strong>
            <span className="ml-2 font-mono bg-gray-100 px-2">
              {[...new Set(standings.map(s => s.group_id))].map(id => `"${id}"`).join(', ') || '(なし)'}
            </span>
          </div>
          {groups.length > 0 && teams.length > 0 && (
            <div className={`p-3 rounded ${
              groups.every(g => teams.some(t => t.group_id === g.id))
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {groups.every(g => teams.some(t => t.group_id === g.id))
                ? '✅ グループIDとチームのgroup_idが一致しています'
                : '❌ グループIDとチームのgroup_idが一致していません！'
              }
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 text-center text-gray-500 text-sm">
        Supabase URL: {import.meta.env.VITE_SUPABASE_URL}
      </div>
    </div>
  )
}
