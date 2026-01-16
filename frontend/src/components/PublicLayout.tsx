import { Outlet, Link, useLocation } from 'react-router-dom';
import { Trophy, Calendar, List, Award } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { tournamentsApi } from '@/lib/api';

function PublicLayout() {
    const location = useLocation();
    const { currentTournament, setCurrentTournament } = useAppStore();

    // 大会情報を取得（まだストアにない場合）
    const { data: tournament } = useQuery({
        queryKey: ['tournament', 1],
        queryFn: () => tournamentsApi.getById(1),
        enabled: !currentTournament, // ストアにない場合のみ取得
    });

    // ストアに保存
    useEffect(() => {
        if (tournament && !currentTournament) {
            setCurrentTournament(tournament);
        }
    }, [tournament, currentTournament, setCurrentTournament]);

    // 大会名を取得（設定されていなければデフォルト）
    const activeTournament = currentTournament || tournament;
    const tournamentName = activeTournament?.shortName || activeTournament?.name || '浦和カップ';

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <header className="bg-gradient-to-r from-red-700 to-red-600 text-white shadow-lg">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                        <div>
                            <h1 className="font-bold text-lg leading-tight">{tournamentName}</h1>
                            <p className="text-[10px] text-red-100 opacity-90">
                                {activeTournament?.year ? `${activeTournament.year}年度` : '高校サッカーフェスティバル'}
                            </p>
                        </div>
                    </div>
                    {/* Link to Admin */}
                    <Link to="/login" className="text-xs text-red-200 hover:text-white transition-colors">
                        運営専用
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-6 max-w-lg">
                <Outlet />
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe">
                <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
                    <NavLink
                        to="/public/matches"
                        isActive={location.pathname === '/public/matches'}
                        icon={Calendar}
                        label="速報"
                    />
                    <NavLink
                        to="/public/standings"
                        isActive={location.pathname === '/public/standings'}
                        icon={List}
                        label="順位表"
                    />
                    <NavLink
                        to="/public/scorers"
                        isActive={location.pathname === '/public/scorers'}
                        icon={Award}
                        label="得点王"
                    />
                </div>
            </nav>
        </div>
    );
}

function NavLink({ to, isActive, icon: Icon, label }: { to: string; isActive: boolean; icon: any; label: string }) {
    return (
        <Link to={to} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isActive ? 'text-red-600' : 'text-gray-400'}`}>
            <Icon className={`w-6 h-6 ${isActive ? 'fill-current' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{label}</span>
            {isActive && <span className="absolute bottom-0 w-8 h-1 bg-red-600 rounded-t-full" />}
        </Link>
    );
}

export default PublicLayout;
