import type { ReactNode } from 'react'
import { useRef } from 'react'
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom'

import { AppShell } from './components/layout/app-shell'
import { useAuth } from './context/auth'
import {
  NavigationMemoryProvider,
  useScrollPending,
} from './context/navigation-memory'
import { protectedLoginUrl } from './lib/login-return'
import { RewardsProvider } from './context/rewards'
import { RewardsPage } from './pages/rewards'
import { AdminPage } from './pages/admin'
import { AdminSlotPage } from './pages/admin-slot'
import { ArchivedAgentsPage } from './pages/archived-agents'
import { AgentViewPage } from './pages/agent-view'
import { AgentEntryPage } from './pages/agent-entry'
import { BuilderPage } from './pages/builder'
import { CatalogPage } from './pages/catalog'
import { ExpressPage } from './pages/express'
import { NPCViewPage } from './pages/npc-view'
import { MyAgentsPage } from './pages/my-agents'
import { LandingPage } from './pages/landing'
import { LoginPage } from './pages/login'
import { MatchDetailPage } from './pages/match-detail'
import { MatchesPage } from './pages/matches'
import { NotificationsPage } from './pages/notifications'
import { RegisterPage } from './pages/register'
import { ScenarioDetailPage } from './pages/scenario-detail'
import { ScenarioBuildEntry } from './pages/scenario-build-entry'
import { SettingsPage } from './pages/settings'
import { StandingsPage } from './pages/standings'
import { TournamentsPage } from './pages/tournaments'
import { VersionAgentPage } from './pages/version-agent'
import { TestModeRoot } from './testmode/index'

function Loading() {
  useScrollPending(true)
  return (
    <div className='flex min-h-dvh items-center justify-center bg-(--background) text-sm text-(--foreground-subtle)'>
      正在恢复会话...
    </div>
  )
}

// React Router reuses a route element when only :agentId changes. The Builder
// owns debounced draft state, so key it by agent to guarantee that no visible
// or in-flight editing state can bleed into a sibling agent.
function BuilderRoute() {
  const { agentId = '' } = useParams()
  return <BuilderPage key={agentId} />
}

function RequireAccount() {
  const { account } = useAuth()
  const location = useLocation()
  return account
    ? <Outlet />
    : <Navigate replace to={protectedLoginUrl(location)} />
}

// One layout survives navigation between public scenarios and account pages.
function ApplicationShell() {
  const { isLoading, account } = useAuth()
  if (isLoading) return <Loading />
  const content = (
    <AppShell>
      <Outlet />
    </AppShell>
  )
  return account
    ? <RewardsProvider key={account.id}>{content}</RewardsProvider>
    : content
}

function AdminGate({ children }: { children: ReactNode }) {
  const { account } = useAuth()
  return account?.isAdmin ? children : <Navigate replace to='/scenarios' />
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { isLoading, account } = useAuth()
  // 只挡「本来就已登录」的访客。表单提交成功后的落点由表单页自己决定
  // （注册按 firstBattleDone 落 /express，A3/#9；登录优先回到受保护的原网址）——
  // 提交成功会把 account 写进 auth 上下文，若这里继续无条件抢跳
  // /scenarios，就会与表单页的 navigate 竞态，把新注册用户误送出快速通道。
  const arrivedAuthenticated = useRef<boolean | null>(null)
  if (!isLoading && arrivedAuthenticated.current === null) {
    arrivedAuthenticated.current = account != null
  }
  if (isLoading) return <Loading />
  if (account && arrivedAuthenticated.current === true) {
    return <Navigate replace to='/scenarios' />
  }
  return <>{children}</>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export function AppRoutes() {
  const { account, isLoading } = useAuth()
  return (
    <NavigationMemoryProvider
      scope={account?.id ?? 'guest'}
      enabled={!isLoading}
    >
      <Routes>
        <Route path='/' element={<LandingPage />} />
        <Route
          path='/login'
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path='/register'
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />
        <Route element={<ApplicationShell />}>
          <Route path='/scenarios' element={<CatalogPage />} />
          <Route
            path='/scenarios/:scenarioId'
            element={<ScenarioDetailPage />}
          />
          <Route element={<RequireAccount />}>
            <Route path='/express' element={<ExpressPage />} />
            <Route
              path='/scenarios/:scenarioId/build'
              element={<ScenarioBuildEntry />}
            />
            <Route path='/my-agents' element={<MyAgentsPage />} />
            <Route
              path='/scenarios/:scenarioId/npcs/:presetKey'
              element={<NPCViewPage />}
            />
            <Route path='/agents/entry' element={<AgentEntryPage />} />
            <Route path='/agents/:agentId' element={<AgentViewPage />} />
            <Route path='/agents/:agentId/build' element={<BuilderRoute />} />
            <Route path='/matches' element={<MatchesPage />} />
            <Route path='/matches/:matchId' element={<MatchDetailPage />} />
            <Route path='/tournaments' element={<TournamentsPage />} />
            <Route
              path='/tournaments/:tournamentId'
              element={<StandingsPage />}
            />
            <Route path='/versions/:versionId' element={<VersionAgentPage />} />
            <Route path='/notifications' element={<NotificationsPage />} />
            <Route
              path='/settings/archived-agents'
              element={<ArchivedAgentsPage />}
            />
            <Route path='/settings' element={<SettingsPage />} />
            <Route path='/rewards' element={<RewardsPage />} />
            <Route
              path='/admin'
              element={
                <AdminGate>
                  <AdminPage />
                </AdminGate>
              }
            />
            <Route
              path='/admin/slots/:slotId'
              element={
                <AdminGate>
                  <AdminSlotPage />
                </AdminGate>
              }
            />
            <Route path='*' element={<Navigate replace to='/scenarios' />} />
          </Route>
        </Route>
      </Routes>
      {/* 测试模式（?tm=1）：挂在 Routes 旁边，所有路由都能用；关着时零成本。 */}
      <TestModeRoot />
    </NavigationMemoryProvider>
  )
}
