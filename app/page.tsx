'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  ROLES,
  DEPARTMENTS,
  TEAMS,
  DOC_STEPS,
  RoleKey,
  canEnterExecutives,
  canWriteChat,
  nextStepFor,
  teamName,
  deptName,
} from "@/lib/data";

type Profile = {
  id: string;
  login_id: string;
  name: string;
  role: RoleKey;
  status: "pending" | "active" | "suspended";
  team_id?: string | null;
  dept_id?: string | null;
};

type Notice = {
  id: string; title: string; body: string; pinned: boolean; target: string;
  writer_id?: string | null; writer_name?: string | null; created_at: string;
};

type EventRow = {
  id: string; title: string; event_date: string; place: string; dept: string;
  writer_name?: string | null; writer_id?: string | null; created_at: string;
};

type DocumentRow = {
  id: string; title: string; category: string; visibility: string;
  uploader_id: string; uploader_name: string; team_id?: string | null; dept_id?: string | null;
  step: string; file_name?: string | null; file_path?: string | null; created_at: string;
};

type HistoryRow = { id: string; document_id: string; who: string; action: string; created_at: string };

type ChatMessage = {
  id: string; room_key: "all" | "executives"; sender_id: string; sender_name: string;
  sender_role: string; content: string; created_at: string;
};

type Suggestion = {
  id: string; title: string; body: string; category: string; is_anonymous: boolean;
  visibility: string; status: string; writer_id: string; writer_name?: string | null;
  answer?: string | null; answered_by?: string | null; created_at: string;
};

const TABS = [
  ["home", "🏠 홈"],
  ["notice", "📢 공지"],
  ["calendar", "📅 일정"],
  ["office", "🗂️ 업무실"],
  ["meeting", "💬 회의실"],
  ["suggest", "💡 건의함"],
  ["plaza", "🎉 학생광장"],
] as const;

const EMOJIS = ["🌟", "😺", "🐱", "😸", "💛", "🥰", "👏", "👍"];

const fmt = (s: string) =>
  new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(s));

function roleLabel(role?: string) {
  return role && role in ROLES ? ROLES[role as RoleKey].label : role ?? "-";
}

function stepLabel(step: string) {
  if (step === "rejected") return "반려";
  return DOC_STEPS.find((x) => x.key === step)?.label ?? step;
}

function AppHeader({
  me,
  tab,
  setTab,
  onLogout,
  onOpenAdmin,
}: {
  me: Profile;
  tab: string;
  setTab: (v: string) => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="logo">
          온라인 학생회
          <small>{me.name} · {roleLabel(me.role)}</small>
        </div>
        <div className="tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
          ))}
          {me.role === "standing_admin" && (
            <button className={`tab ${tab === "admin" ? "active" : ""}`} onClick={onOpenAdmin}>⚙️ 관리자</button>
          )}
          <button className="tab" onClick={onLogout}>로그아웃</button>
        </div>
      </div>
    </header>
  );
}

export default function Page() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSessionUserId(data.session?.user.id ?? null);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSessionUserId(session?.user.id ?? null);
      if (!session) {
        setMe(null);
        setLoading(false);
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!sessionUserId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", sessionUserId).maybeSingle();
      if (cancelled) return;
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }
      setMe(data as Profile | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionUserId]);

  const logout = async () => {
    await supabase.auth.signOut();
    setTab("home");
  };

  if (loading) return <div className="login-wrap"><div className="card"><h3>온라인 학생회 불러오는 중…</h3><div className="muted">잠시만 기다려줘.</div></div></div>;
  if (!me) return <Login onMessage={setMessage} message={message} />;

  const openAdmin = () => { setTab("admin"); };
  return (
    <>
      <AppHeader me={me} tab={tab} setTab={setTab} onLogout={logout} onOpenAdmin={openAdmin} />
      <main className="wrap">
        {message && (
          <div className="card" style={{ borderColor: "#93c5fd", background: "#eff6ff" }}>
            <div className="row"><strong>알림</strong><span>{message}</span><button className="btn ghost small" onClick={() => setMessage("")}>닫기</button></div>
          </div>
        )}
        {tab === "home" && <Home me={me} setTab={setTab} setMessage={setMessage} />}
        {tab === "notice" && <NoticePage me={me} setMessage={setMessage} />}
        {tab === "calendar" && <CalendarPage me={me} setMessage={setMessage} />}
        {tab === "office" && <OfficePage me={me} setMessage={setMessage} />}
        {tab === "meeting" && <MeetingPage me={me} setMessage={setMessage} />}
        {tab === "suggest" && <SuggestionPage me={me} setMessage={setMessage} />}
        {tab === "plaza" && <PlazaPage me={me} setMessage={setMessage} />}
        {tab === "admin" && me.role === "standing_admin" && <AdminPage me={me} setMessage={setMessage} />}
      </main>
    </>
  );
}

function Login({ onMessage, message }: { onMessage: (v: string) => void; message: string }) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState(false);
  const [signupName, setSignupName] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    onMessage("");
    const normalizedLoginId = loginId.trim().toLowerCase();
    const email = normalizedLoginId.includes("@")
      ? normalizedLoginId
      : normalizedLoginId === "siyoon.com123"
        ? "siyoon.com123@kakao.com"
        : `${normalizedLoginId}@jagum-office.local`;
    if (signup) {
      if (password.length < 8) { onMessage("비밀번호는 8자 이상이어야 해."); setBusy(false); return; }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { login_id: loginId.trim().toLowerCase(), name: signupName.trim() || loginId.trim() } }
      });
      onMessage(error ? error.message : "가입 요청이 접수됐어. 관리자 승인 후 사용할 수 있어.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) onMessage("아이디 또는 비밀번호를 확인해줘.");
    }
    setBusy(false);
  };
  return (
    <div className="login-wrap">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>온라인 학생회</h2>
        <div className="muted" style={{ marginBottom: 16 }}>학생회 공지, 일정, 업무, 회의, 건의함을 한곳에서.</div>
        <form onSubmit={submit}>
          {signup && <input className="input" placeholder="이름" value={signupName} onChange={(e) => setSignupName(e.target.value)} style={{ marginBottom: 8 }} />}
          <input className="input" placeholder="아이디" value={loginId} onChange={(e) => setLoginId(e.target.value)} style={{ marginBottom: 8 }} autoCapitalize="none" />
          <input className="input" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} type="password" style={{ marginBottom: 10 }} />
          {message && <div className="muted" style={{ marginBottom: 10 }}>{message}</div>}
          <button className="btn" disabled={busy}>{busy ? "처리 중…" : signup ? "학생 가입" : "로그인"}</button>
        </form>
        <div className="section-gap" />
        <button className="btn ghost small" onClick={() => setSignup((v) => !v)}>{signup ? "로그인으로 돌아가기" : "새 학생 가입"}</button>
      </div>
    </div>
  );
}

function Home({ me, setTab, setMessage }: { me: Profile; setTab: (v: string) => void; setMessage: (v: string) => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  useEffect(() => {
    Promise.all([
      supabase.from("notices").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(5),
      supabase.from("events").select("*").order("event_date", { ascending: true }).limit(5)
    ]).then(([n, e]) => {
      if (n.error) setMessage(n.error.message);
      if (e.error) setMessage(e.error.message);
      setNotices((n.data ?? []) as Notice[]);
      setEvents((e.data ?? []) as EventRow[]);
    });
  }, [setMessage]);
  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>안녕하세요, {me.name}! 👋</h2>
        <div className="muted">소속: {deptName(me.dept_id ?? undefined)} · {teamName(me.team_id ?? undefined)}</div>
      </div>
      <div className="grid2">
        <div className="card">
          <h3>📌 최신 공지</h3>
          {notices.length ? notices.map(n => <div key={n.id} className="item-panel"><strong>{n.pinned ? "📌 " : ""}{n.title}</strong><div className="muted">{fmt(n.created_at)}</div><div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{n.body}</div></div>) : <div className="muted">아직 공지가 없어.</div>}
          <button className="btn ghost small" onClick={() => setTab("notice")}>공지 전체 보기</button>
        </div>
        <div className="card">
          <h3>📅 다가오는 일정</h3>
          {events.length ? events.map(e => <div key={e.id} className="item-panel"><strong>{e.title}</strong><div>{e.event_date} · {e.place || "장소 미정"}</div><div className="muted">{e.dept || "전체"}</div></div>) : <div className="muted">등록된 일정이 없어.</div>}
          <button className="btn ghost small" onClick={() => setTab("calendar")}>일정 전체 보기</button>
        </div>
      </div>
      <div className="grid2">
        <div className="card"><h3>🗂️ 업무실</h3><div className="muted">회의 문서와 결재 상태를 확인해.</div><button className="btn small" style={{ marginTop: 10 }} onClick={() => setTab("office")}>업무실 열기</button></div>
        <div className="card"><h3>💡 건의함</h3><div className="muted">학교생활 아이디어를 올리고 답변을 받아봐.</div><button className="btn small" style={{ marginTop: 10 }} onClick={() => setTab("suggest")}>건의함 열기</button></div>
      </div>
      <div className="card">
        <h3>🎮 학습 게임</h3>
        <div className="muted">학생회 메뉴에서 바로 들어갈 수 있는 간단한 학습 게임 공간이야.</div>
        <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => setMessage("학습 게임 메뉴는 별도 게임 모듈을 연결하면 바로 사용할 수 있어.")}>학습 게임 메뉴 안내</button>
      </div>
    </>
  );
}

function NoticePage({ me, setMessage }: { me: Profile; setMessage: (v: string) => void }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [pinned, setPinned] = useState(false);
  const canPost = ["president", "vice_president", "standing_admin", "teacher_jachi"].includes(me.role);
  const refresh = async () => {
    const { data, error } = await supabase.from("notices").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
    if (error) setMessage(error.message); else setItems((data ?? []) as Notice[]);
  };
  useEffect(() => { refresh(); }, []);
  const post = async () => {
    if (!title.trim()) return setMessage("공지 제목을 입력해줘.");
    const { error } = await supabase.from("notices").insert({ title: title.trim(), body: body.trim(), pinned: canPost ? pinned : false, writer_id: me.id, writer_name: me.name });
    if (error) setMessage(error.message); else { setTitle(""); setBody(""); setPinned(false); setMessage("공지가 등록됐어."); refresh(); }
  };
  const togglePin = async (n: Notice) => {
    if (!canPost) return;
    const { error } = await supabase.from("notices").update({ pinned: !n.pinned }).eq("id", n.id);
    if (error) setMessage(error.message);
    else {
      await supabase.from("audit_logs").insert({ actor: me.name, action: `공지 고정 ${!n.pinned ? "설정" : "해제"}: ${n.title}` });
      refresh();
    }
  };
  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>📢 공지사항</h2>
        {canPost && (
          <div className="form-panel">
            <input className="input" placeholder="공지 제목" value={title} onChange={e => setTitle(e.target.value)} />
            <div className="section-gap small" />
            <textarea className="textarea" rows={4} placeholder="공지 내용" value={body} onChange={e => setBody(e.target.value)} />
            <div className="row" style={{ marginTop: 8 }}>
              <label><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> 📌 홈에 고정</label>
              <button className="btn" onClick={post}>공지 등록</button>
            </div>
          </div>
        )}
      </div>
      <div className="card">
        {items.length ? items.map(n => (
          <div key={n.id} className="item-panel">
            <div className="row"><strong>{n.pinned ? "📌 " : ""}{n.title}</strong><span className="badge">{n.target}</span></div>
            <div className="muted">{n.writer_name || "작성자"} · {fmt(n.created_at)}</div>
            <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{n.body}</div>
            {canPost && <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => togglePin(n)}>{n.pinned ? "📌 고정 해제" : "📌 고정"}</button>}
          </div>
        )) : <div className="muted">등록된 공지가 없어.</div>}
      </div>
    </>
  );
}

function CalendarPage({ me, setMessage }: { me: Profile; setMessage: (v: string) => void }) {
  const [items, setItems] = useState<EventRow[]>([]);
  const [title, setTitle] = useState(""); const [date, setDate] = useState(""); const [place, setPlace] = useState(""); const [dept, setDept] = useState("");
  const canPost = ["team_leader","dept_head","general_committee","vice_president","president","standing_admin"].includes(me.role);
  const refresh = async () => {
    const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: true });
    if (error) setMessage(error.message); else setItems((data ?? []) as EventRow[]);
  };
  useEffect(() => { refresh(); }, []);
  const post = async () => {
    if (!title.trim() || !date) return setMessage("일정 제목과 날짜를 입력해줘.");
    const { error } = await supabase.from("events").insert({ title: title.trim(), event_date: date, place: place.trim(), dept: dept.trim(), writer_name: me.name, writer_id: me.id });
    if (error) setMessage(error.message); else { setTitle(""); setDate(""); setPlace(""); setDept(""); refresh(); }
  };
  return (
    <>
      <div className="card"><h2 style={{ marginTop: 0 }}>📅 일정</h2>{canPost && <div className="form-panel">
        <div className="grid2">
          <input className="input" placeholder="일정 제목" value={title} onChange={e=>setTitle(e.target.value)} />
          <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
          <input className="input" placeholder="장소" value={place} onChange={e=>setPlace(e.target.value)} />
          <input className="input" placeholder="담당 부서 (예: 기획부)" value={dept} onChange={e=>setDept(e.target.value)} />
        </div>
        <button className="btn" style={{ marginTop: 10 }} onClick={post}>일정 등록</button>
      </div>}</div>
      <div className="card">{items.length ? items.map(e => <div key={e.id} className="item-panel"><div className="row"><strong>{e.title}</strong><span className="badge gray">{e.dept || "전체"}</span></div><div>{e.event_date} · {e.place || "장소 미정"}</div><div className="muted">등록: {e.writer_name || "-"}</div></div>) : <div className="muted">등록된 일정이 없어.</div>}</div>
    </>
  );
}

function OfficePage({ me, setMessage }: { me: Profile; setMessage: (v: string) => void }) {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [title, setTitle] = useState(""); const [category, setCategory] = useState("기타"); const [visibility, setVisibility] = useState("임원공개");
  const [selected, setSelected] = useState<DocumentRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const canCreate = ["general_officer","team_leader","dept_head","general_committee","vice_president","president","standing_admin"].includes(me.role);

  const refresh = async () => {
    const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
    if (error) setMessage(error.message); else setDocs((data ?? []) as DocumentRow[]);
  };
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (!selected) { setHistory([]); return; }
    supabase.from("doc_history").select("*").eq("document_id", selected.id).order("created_at", { ascending: false })
      .then(({data,error}) => { if(error) setMessage(error.message); else setHistory((data ?? []) as HistoryRow[]); });
  }, [selected, setMessage]);
  const createDoc = async () => {
    if (!title.trim()) return setMessage("문서 제목을 입력해줘.");
    let filePath = "";
    if (file) {
      filePath = `${me.id}/${crypto.randomUUID()}-${file.name}`;
      const up = await supabase.storage.from("documents").upload(filePath, file, { upsert: false });
      if (up.error) return setMessage(up.error.message);
    }
    const { data, error } = await supabase.from("documents").insert({
      title: title.trim(), category, visibility,
      uploader_id: me.id, uploader_name: me.name,
      team_id: me.team_id ?? null, dept_id: me.dept_id ?? null,
      step: "draft", file_name: file?.name ?? null, file_path: filePath || null
    }).select().single();
    if (error) { setMessage(error.message); return; }
    if (data) await supabase.from("doc_history").insert({ document_id: data.id, who: me.name, action: "문서 생성" });
    setTitle(""); setFile(null); refresh();
  };
  const submit = async (d: DocumentRow) => {
    if (!["draft","rejected"].includes(d.step)) return;
    const { error } = await supabase.from("documents").update({ step: "submitted" }).eq("id", d.id);
    if (error) setMessage(error.message); else { await supabase.from("doc_history").insert({ document_id:d.id, who:me.name, action:"제출" }); refresh(); }
  };
  const advance = async (d: DocumentRow) => {
    const next = nextStepFor(me.role, d.step);
    if (!next) return setMessage("현재 단계에서 네가 처리할 수 있는 결재가 없어.");
    const to = next === "__admin__" ? (d.step === "committee_ok" ? "president_ok" : d.step) : next;
    if (to === d.step) return setMessage("관리자 결재는 필요한 단계에서 별도 처리할 수 있어.");
    const { error } = await supabase.from("documents").update({ step: to }).eq("id", d.id);
    if (error) setMessage(error.message);
    else { await supabase.from("doc_history").insert({ document_id:d.id, who:me.name, action:`${stepLabel(d.step)} → ${stepLabel(to)}` }); refresh(); }
  };
  return (
    <>
      <div className="card">
        <h2 style={{ marginTop: 0 }}>🗂️ 업무실</h2>
        <div className="muted">문서 작성 → 제출 → 팀 → 부서 → 총괄 → 회장단 → 자치부장 → 교감 → 교장 최종승인 흐름.</div>
        {canCreate && <div className="form-panel" style={{ marginTop: 12 }}>
          <div className="grid2"><input className="input" placeholder="문서 제목" value={title} onChange={e=>setTitle(e.target.value)} /><select className="select" value={category} onChange={e=>setCategory(e.target.value)}><option>기타</option><option>행사</option><option>건의</option><option>정책</option><option>회의</option></select><select className="select" value={visibility} onChange={e=>setVisibility(e.target.value)}><option>임원공개</option><option>전체공개</option><option>관련부서만</option><option>비공개-결재자만</option></select><input type="file" className="input" onChange={e=>setFile(e.target.files?.[0] ?? null)} /></div>
          <button className="btn" style={{ marginTop: 10 }} onClick={createDoc}>문서 저장</button>
        </div>}
      </div>
      <div className="card">
        {docs.length ? docs.map(d => (
          <div key={d.id} className="item-panel">
            <div className="row"><strong>{d.title}</strong><span className={`badge ${d.step === "done" ? "green" : d.step === "rejected" ? "red" : "amber"}`}>{stepLabel(d.step)}</span></div>
            <div className="muted">{d.category} · {d.visibility} · {d.uploader_name}</div>
            <div className="timeline">{DOC_STEPS.map((s, i) => <div key={s.key}><strong>{i+1}. {s.label}</strong>{d.step===s.key && <span className="badge">현재</span>}</div>)}</div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn ghost small" onClick={()=>setSelected(d)}>이력 보기</button>
              {d.step === "draft" && d.uploader_id === me.id && <button className="btn small" onClick={()=>submit(d)}>제출</button>}
              {nextStepFor(me.role, d.step) && nextStepFor(me.role, d.step) !== "__admin__" && <button className="btn small" onClick={()=>advance(d)}>승인 진행</button>}
            </div>
          </div>
        )) : <div className="muted">보이는 문서가 없어.</div>}
      </div>
      {selected && <div className="card"><div className="row"><h3 style={{ margin: 0 }}>{selected.title} · 결재 이력</h3><button className="btn ghost small" onClick={()=>setSelected(null)}>닫기</button></div>{history.length ? history.map(h=><div key={h.id} className="item-panel"><strong>{h.action}</strong><div className="muted">{h.who} · {fmt(h.created_at)}</div></div>) : <div className="muted">이력이 없어.</div>}</div>}
    </>
  );
}

function MeetingPage({ me, setMessage }: { me: Profile; setMessage: (v: string) => void }) {
  const [room, setRoom] = useState<"executives"|"all">(canEnterExecutives(me) ? "executives" : "all");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [subKey, setSubKey] = useState(0);
  const load = async () => {
    const { data, error } = await supabase.from("chat_messages").select("*").eq("room_key", room).order("created_at", { ascending: true }).limit(300);
    if (error) setMessage(error.message); else setMessages((data ?? []) as ChatMessage[]);
  };
  useEffect(() => {
    load();
    const channel = supabase.channel(`chat-${room}-${subKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `room_key=eq.${room}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [room, subKey]);
  const send = async (content = text) => {
    const msg = content.trim();
    if (!canWriteChat(me, room)) return setMessage("이 방에서는 메시지를 보낼 수 없어.");
    if (!msg) return;
    if (msg.length > 500) return setMessage("메시지는 500자까지야.");
    setSending(true);
    const { error } = await supabase.from("chat_messages").insert({ room_key:room, sender_id:me.id, sender_name:me.name, sender_role:me.role, content:msg });
    if (error) setMessage(error.message); else setText("");
    setSending(false);
  };
  return (
    <div className="card">
      <div className="row"><h2 style={{ margin: 0 }}>💬 회의실 / 학생광장</h2>
        {canEnterExecutives(me) && <><button className={`btn small ${room==="executives"?"":"ghost"}`} onClick={()=>setRoom("executives")}>임원회의실</button><button className={`btn small ${room==="all"?"":"ghost"}`} onClick={()=>setRoom("all")}>전체광장</button></>}
      </div>
      <div className="muted" style={{ marginTop: 6 }}>{room==="executives" ? "임원 및 교직원 접근용 채팅방" : "모든 재학생이 참여하는 대화 공간"}</div>
      <div className="chatbox" style={{ marginTop: 12 }}>
        {messages.map(m=><div key={m.id} className={`bubble ${m.sender_id===me.id?"me":"other"}`}><span className="who">{m.sender_name} · {roleLabel(m.sender_role)}</span>{m.content}</div>)}
        {!messages.length && <div className="muted">아직 메시지가 없어.</div>}
      </div>
      {canWriteChat(me, room) && <div style={{ marginTop: 10 }}>
        <div className="row" style={{ marginBottom: 8 }}>{EMOJIS.map(e=><button key={e} className="btn ghost small" disabled={sending} onClick={()=>send(e)}>{e}</button>)}</div>
        <div className="row"><input className="input" maxLength={500} value={text} onChange={e=>setText(e.target.value)} placeholder="메시지를 입력해줘." onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault(); send();} }} /><button className="btn" disabled={sending} onClick={()=>send()}>{sending ? "전송…" : "전송"}</button></div>
        <div className="muted" style={{ marginTop: 5 }}>{text.length}/500</div>
      </div>}
    </div>
  );
}

function SuggestionPage({ me, setMessage }: { me: Profile; setMessage: (v: string) => void }) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [category, setCategory] = useState("기타"); const [anonymous, setAnonymous] = useState(false);
  const canAnswer = ["general_officer","team_leader","dept_head","general_committee","vice_president","president","standing_admin","teacher_jachi"].includes(me.role);
  const refresh = async () => {
    const { data, error } = await supabase.from("suggestions").select("*").order("created_at", { ascending: false });
    if (error) setMessage(error.message); else setItems((data ?? []) as Suggestion[]);
    const { data: l } = await supabase.from("suggestion_likes").select("suggestion_id").eq("user_id", me.id);
    setLikes(Object.fromEntries((l ?? []).map((x:any)=>[x.suggestion_id,true])));
  };
  useEffect(()=>{refresh();},[]);
  const post = async () => {
    if (!title.trim() || !body.trim()) return setMessage("제목과 내용을 입력해줘.");
    const { error } = await supabase.from("suggestions").insert({
      title:title.trim(), body:body.trim(), category, is_anonymous:anonymous, visibility:"전체공개",
      writer_id:me.id, writer_name:anonymous ? "익명" : me.name
    });
    if (error) setMessage(error.message); else { setTitle(""); setBody(""); setAnonymous(false); refresh(); }
  };
  const like = async (s: Suggestion) => {
    const active = !!likes[s.id];
    const q = active
      ? supabase.from("suggestion_likes").delete().eq("suggestion_id", s.id).eq("user_id", me.id)
      : supabase.from("suggestion_likes").insert({ suggestion_id:s.id, user_id:me.id });
    const { error } = await q;
    if (error) setMessage(error.message); else refresh();
  };
  const answer = async (s: Suggestion) => {
    const value = window.prompt("답변을 입력해줘.", s.answer ?? "");
    if (value === null) return;
    const { error } = await supabase.from("suggestions").update({ answer:value, answered_by:me.name, status:value.trim()?"답변완료":"접수" }).eq("id", s.id);
    if (error) setMessage(error.message); else refresh();
  };
  return (
    <>
      <div className="card"><h2 style={{ marginTop: 0 }}>💡 건의함</h2>
        <div className="form-panel">
          <input className="input" placeholder="건의 제목" value={title} onChange={e=>setTitle(e.target.value)} />
          <div className="section-gap small" /><textarea className="textarea" rows={4} placeholder="건의 내용" value={body} onChange={e=>setBody(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}><select className="select" style={{ width: 150 }} value={category} onChange={e=>setCategory(e.target.value)}><option>기타</option><option>급식</option><option>시설</option><option>행사</option><option>생활규정</option></select><label><input type="checkbox" checked={anonymous} onChange={e=>setAnonymous(e.target.checked)} /> 익명</label><button className="btn" onClick={post}>건의 등록</button></div>
        </div>
      </div>
      <div className="card">
        {items.length ? items.map(s=><div className="item-panel" key={s.id}><div className="row"><strong>{s.title}</strong><span className={`badge ${s.status==="답변완료"?"green":"amber"}`}>{s.status}</span></div><div className="muted">{s.is_anonymous?"익명":s.writer_name} · {s.category} · {fmt(s.created_at)}</div><div style={{ marginTop: 8, whiteSpace:"pre-wrap" }}>{s.body}</div><div className="row" style={{ marginTop:8 }}><button className="btn ghost small" onClick={()=>like(s)}>{likes[s.id]?"💙 공감 취소":"💙 공감"} </button>{canAnswer&&<button className="btn small" onClick={()=>answer(s)}>답변</button>}</div>{s.answer && <div className="form-panel" style={{ marginTop: 8 }}><strong>답변 · {s.answered_by || "-"}</strong><div style={{ whiteSpace:"pre-wrap", marginTop: 4 }}>{s.answer}</div></div>}</div>) : <div className="muted">등록된 건의가 없어.</div>}
      </div>
    </>
  );
}

function PlazaPage({ me, setMessage }: { me: Profile; setMessage: (v: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  useEffect(() => {
    supabase.from("chat_messages").select("*").eq("room_key","all").order("created_at",{ascending:true}).limit(300)
      .then(({data,error})=>{if(error)setMessage(error.message);else setMessages((data??[]) as ChatMessage[])});
    const channel = supabase.channel("plaza-home").on("postgres_changes",{event:"*",schema:"public",table:"chat_messages",filter:"room_key=eq.all"},()=> {
      supabase.from("chat_messages").select("*").eq("room_key","all").order("created_at",{ascending:true}).limit(300)
        .then(({data})=>setMessages((data??[]) as ChatMessage[]));
    }).subscribe();
    return ()=>{supabase.removeChannel(channel);};
  }, [setMessage]);
  return <div className="card"><h2 style={{ marginTop: 0 }}>🎉 학생광장</h2><div className="muted">전체광장의 최근 대화야. 메시지를 보내려면 회의실 메뉴로 가면 돼.</div><div className="chatbox" style={{ marginTop:12 }}>{messages.map(m=><div key={m.id} className={`bubble ${m.sender_id===me.id?"me":"other"}`}><span className="who">{m.sender_name}</span>{m.content}</div>)}{!messages.length&&<div className="muted">아직 대화가 없어.</div>}</div></div>;
}

function AdminPage({ me, setMessage }: { me: Profile; setMessage: (v: string) => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loginId, setLoginId] = useState(""); const [name, setName] = useState(""); const [password, setPassword] = useState(""); const [role, setRole] = useState<RoleKey>("teacher_jachi");
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [generatedAccounts, setGeneratedAccounts] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const { data,error } = await supabase.from("profiles").select("*").order("created_at",{ascending:true});
    if(error) setMessage(error.message); else setProfiles((data??[]) as Profile[]);
  };
  useEffect(()=>{refresh();},[]);
  const saveTeacher = async () => {
    if (!loginId.trim() || !name.trim() || password.length<8) return setMessage("아이디/이름/비밀번호(8자 이상)를 확인해줘.");
    setBusy(true);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-staff-user`, {
      method:"POST", headers:{Authorization:`Bearer ${sess.session?.access_token ?? ""}`,"Content-Type":"application/json"},
      body:JSON.stringify({login_id:loginId.trim(),name:name.trim(),password,role})
    });
    const json = await res.json().catch(()=>({}));
    if(!res.ok) setMessage(json.error||"교직원 계정 생성 실패");
    else { setMessage("계정을 생성했어."); setLoginId(""); setName(""); setPassword(""); refresh(); }
    setBusy(false);
  };
  const parseCsv = (raw: string) => {
    const lines = raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if (!lines.length) return [];
    const header = lines[0].split(",").map(x=>x.trim());
    const idx = (name:string) => header.findIndex(x=>x===name);
    const gi=idx("학년"), ci=idx("반"), ni=idx("번호"), li=idx("아이디"), pi=idx("비밀번호");
    if ([li,pi].some(x=>x<0)) throw new Error("CSV에 아이디/비밀번호 열이 필요해.");
    return lines.slice(1).map(line=>{
      const cols=line.split(",");
      const grade=(gi>=0?cols[gi]:"").trim(), cls=(ci>=0?cols[ci]:"").trim(), num=(ni>=0?cols[ni]:"").trim();
      return {
        login_id:(cols[li]||"").trim().toLowerCase(),
        name: grade&&cls&&num ? `${grade}학년 ${cls}반 ${num}번` : (cols[li]||"").trim(),
        password:(cols[pi]||"").trim(),
        role:"general_student"
      };
    }).filter(x=>x.login_id&&x.password);
  };
  const createBulk = async (accounts: any[]) => {
    if (!accounts.length) return setMessage("생성할 계정이 없어.");
    setBulkBusy(true); setBulkStatus(`총 ${accounts.length}개 계정 생성 시작`);
    const { data: sess } = await supabase.auth.getSession();
    let created=0, failed=0;
    for (let i=0;i<accounts.length;i+=50) {
      const batch=accounts.slice(i,i+50);
      const res=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://okbhmcsauzritskouuet.supabase.co"}/functions/v1/create-bulk-users`,{
        method:"POST",headers:{Authorization:`Bearer ${sess.session?.access_token ?? ""}`,"Content-Type":"application/json"},
        body:JSON.stringify({accounts:batch})
      });
      const json=await res.json().catch(()=>({}));
      if(!res.ok){ failed+=batch.length; setBulkStatus(`오류: ${json.error||res.status}`); break; }
      created += (json.created?.length||0); failed += (json.failed?.length||0);
      setBulkStatus(`${Math.min(i+50,accounts.length)}/${accounts.length} 처리 · 성공 ${created} · 실패 ${failed}`);
    }
    setBulkBusy(false); refresh();
    setMessage(`일괄생성 완료 · 성공 ${created} · 실패 ${failed}`);
  };
  const downloadAccountsCsv = () => {
    if (!generatedAccounts.length) return setMessage("먼저 1,260명 계정을 생성 대상으로 준비해줘.");
    const rows = [
      ["학년","반","번호","아이디","비밀번호","이름","역할"],
      ...generatedAccounts.map((a:any) => {
        const m = String(a.login_id).match(/^(\\d)-(\\d{2})-(\\d{2})$/);
        return m
          ? [m[1], String(Number(m[2])), String(Number(m[3])), a.login_id, a.password, a.name, a.role]
          : ["","", "", a.login_id, a.password, a.name, a.role];
      })
    ];
    const csv = rows.map((row:any[]) => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\\n");
    const blob = new Blob(["\\ufeff", csv], {type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "온라인학생회_생성계정표_1260명.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const uploadCsv = async (file: File) => {
    try { const raw=await file.text(); const accounts=parseCsv(raw); await createBulk(accounts); }
    catch(e){setMessage(e instanceof Error?e.message:"CSV 읽기 실패");}
  };
  const generatePreset = () => {
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const password = () => "Jg!"+Array.from({length:9},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
    const accounts:any[]=[];
    for(let grade=3;grade<=6;grade++){
      for(let cls=1;cls<=10;cls++){
        for(let num=1;num<=30;num++){
          accounts.push({login_id:`${grade}-${String(cls).padStart(2,"0")}-${String(num).padStart(2,"0")}`,name:`${grade}학년 ${cls}반 ${num}번`,password:password(),role:"general_student"});
        }
      }
    }
    for(let grade=4;grade<=6;grade++){
      for(let cls=1;cls<=10;cls++){
        for(let officer=1;officer<=2;officer++){
          accounts.push({login_id:`officer-${grade}-${String(cls).padStart(2,"0")}-${officer}`,name:`${grade}학년 ${cls}반 일반임원 ${officer}`,password:password(),role:"general_officer"});
        }
      }
    }
    return accounts;
  };
  const updateProfile = async (p: Profile, patch: Partial<Profile>) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id",p.id);
    if(error) setMessage(error.message); else refresh();
  };
  return (
    <>
      <div className="card"><h2 style={{ marginTop: 0 }}>⚙️ 관리자</h2><div className="muted">관리자 전용 화면이야. 현재 계정: {me.name}.</div></div>
      <div className="grid2">
        <div className="card"><h3>교직원 계정</h3><input className="input" placeholder="아이디" value={loginId} onChange={e=>setLoginId(e.target.value)} style={{marginBottom:8}} /><input className="input" placeholder="이름" value={name} onChange={e=>setName(e.target.value)} style={{marginBottom:8}} /><input className="input" placeholder="비밀번호 8자 이상" type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{marginBottom:8}} /><select className="select" value={role} onChange={e=>setRole(e.target.value as RoleKey)}><option value="teacher_jachi">자치부장 선생님</option><option value="teacher_gyogam">교감선생님</option><option value="teacher_gyojang">교장선생님</option></select><button className="btn" style={{marginTop:10}} disabled={busy} onClick={saveTeacher}>{busy?"생성 중…":"교직원 계정 생성"}</button></div>
        <div className="card"><h3>🚀 1,260명 계정 생성</h3><div className="muted">3~6학년 학생 1,200명 + 4~6학년 각 반 임원 2명씩 60명.</div><div className="row" style={{marginTop:10}}><button className="btn" disabled={bulkBusy} onClick={()=>{const accounts=generatePreset(); setGeneratedAccounts(accounts); createBulk(accounts);}}>{bulkBusy?"생성 중…":"1,260명 생성 시작"}</button><button className="btn ghost" disabled={bulkBusy} onClick={()=>fileRef.current?.click()}>CSV로 생성</button><button className="btn ghost" disabled={bulkBusy || !generatedAccounts.length} onClick={downloadAccountsCsv}>계정표 다운로드</button><input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={e=>{const f=e.target.files?.[0]; if(f) uploadCsv(f); e.currentTarget.value="";}} /></div>{bulkStatus&&<div className="muted" style={{marginTop:8}}>{bulkStatus}</div>}{generatedAccounts.length>0&&<div className="muted" style={{marginTop:8}}>생성 대상 {generatedAccounts.length.toLocaleString()}명의 아이디·비밀번호 표를 다운로드할 수 있어.</div>}</div>
      </div>
      <div className="card"><h3>👥 계정 관리</h3><div style={{overflowX:"auto"}}><table className="table"><thead><tr><th>아이디</th><th>이름</th><th>역할</th><th>상태</th><th>부서/팀</th><th>변경</th></tr></thead><tbody>{profiles.map(p=><tr key={p.id}><td>{p.login_id}</td><td>{p.name}</td><td>{roleLabel(p.role)}</td><td>{p.status}</td><td>{deptName(p.dept_id??undefined)} / {teamName(p.team_id??undefined)}</td><td><div className="row"><select className="select" value={p.role} onChange={e=>updateProfile(p,{role:e.target.value as RoleKey})}>{Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select><select className="select" value={p.status} onChange={e=>updateProfile(p,{status:e.target.value as Profile["status"]})}><option value="active">active</option><option value="pending">pending</option><option value="suspended">suspended</option></select></div></td></tr>)}</tbody></table></div></div>
    </>
  );
}
