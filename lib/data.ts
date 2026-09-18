export type RoleKey =
  | "general_student" | "general_officer" | "team_leader" | "dept_head"
  | "general_committee" | "vice_president" | "president"
  | "standing_admin" | "assistant" | "teacher_jachi" | "teacher_gyogam" | "teacher_gyojang";

export const ROLES: Record<RoleKey, { label: string; short: string; level: number; isTeacher?: boolean }> = {
  general_student: { label: "일반 학생", short: "학생", level: 0 },
  general_officer: { label: "일반 임원", short: "임원", level: 1 },
  team_leader: { label: "팀장급 임원", short: "팀장", level: 2 },
  dept_head: { label: "부장급 임원", short: "부장", level: 3 },
  general_committee: { label: "총괄위원급 임원", short: "총괄위원", level: 4 },
  vice_president: { label: "전교 부회장", short: "부회장", level: 5 },
  president: { label: "전교 회장", short: "회장", level: 6 },
  standing_admin: { label: "총괄 상임위원 겸 관리자", short: "상임위원★", level: 99 },
  assistant: { label: "총괄보조부 (외부인)", short: "보조부", level: 0 },
  teacher_jachi: { label: "자치부장 선생님", short: "자치부장", level: 10, isTeacher: true },
  teacher_gyogam: { label: "교감선생님", short: "교감", level: 11, isTeacher: true },
  teacher_gyojang: { label: "교장선생님", short: "교장", level: 12, isTeacher: true },
};
export const DEPARTMENTS = [
  { id: "plan", name: "기획부" }, { id: "promo", name: "홍보부" }, { id: "manage", name: "진행부" },
];
export const TEAMS = [
  { id: "event-plan", deptId: "plan", name: "행사기획팀" },
  { id: "suggest-plan", deptId: "plan", name: "건의사항관리기획팀" },
  { id: "policy-promo", deptId: "promo", name: "공익/정책홍보팀" },
  { id: "event-promo", deptId: "promo", name: "행사홍보팀" },
  { id: "general-run", deptId: "manage", name: "일반진행부" },
  { id: "safety-run", deptId: "manage", name: "안전진행부" },
];
export const teamName = (id?: string) => TEAMS.find((t) => t.id === id)?.name ?? "-";
export const deptName = (id?: string) => DEPARTMENTS.find((d) => d.id === id)?.name ?? "-";
export function validateStudentId(v: string): string | null {
  if (!/^\d{10}$/.test(v)) return "학번은 숫자 10자리여야 해요. (예: 2021060309)";
  const yyyy = Number(v.slice(0, 4)), grade = Number(v.slice(4, 6)), cls = Number(v.slice(6, 8)), num = Number(v.slice(8, 10));
  if (yyyy < 2015 || yyyy > new Date().getFullYear()) return "입학연도 4자리를 확인해주세요.";
  if (grade < 1 || grade > 6) return "학년(5~6번째 자리)은 01~06이어야 해요.";
  if (cls < 1 || cls > 20) return "반(7~8번째 자리)을 확인해주세요.";
  if (num < 1 || num > 40) return "번호(9~10번째 자리)를 확인해주세요.";
  return null;
}
export const DOC_STEPS = [
  { key: "draft", label: "임시저장" }, { key: "submitted", label: "제출됨" }, { key: "team_ok", label: "팀승인" },
  { key: "dept_ok", label: "부서승인" }, { key: "committee_ok", label: "총괄검토" }, { key: "president_ok", label: "회장단결재" },
  { key: "jachi_ok", label: "자치부장승인" }, { key: "vice_ok", label: "교감검토" }, { key: "done", label: "교장 최종승인 완료" },
] as const;
export function nextStepFor(role: RoleKey, step: string): string | null {
  const order: Record<RoleKey, { from: string; to: string } | null> = {
    general_student: null, general_officer: null, team_leader: { from: "submitted", to: "team_ok" },
    dept_head: { from: "team_ok", to: "dept_ok" }, general_committee: { from: "dept_ok", to: "committee_ok" },
    vice_president: { from: "committee_ok", to: "committee_ok" }, president: { from: "committee_ok", to: "president_ok" },
    teacher_jachi: { from: "president_ok", to: "jachi_ok" }, teacher_gyogam: { from: "jachi_ok", to: "vice_ok" },
    teacher_gyojang: { from: "vice_ok", to: "done" }, standing_admin: null, assistant: null,
  };
  if (role === "standing_admin") return "__admin__";
  if (role === "vice_president") return step === "committee_ok" ? "president_ok" : null;
  const m = order[role]; return m && m.from === step ? m.to : null;
}
export const isTeacher = (r: RoleKey) => !!ROLES[r].isTeacher;
type UserLike = { status?: string; role?: RoleKey };
export const canEnterExecutives = (u: UserLike | null | undefined) =>
  !!u && u.status === "active" && !!u.role &&
  (u.role === "assistant" || (!isTeacher(u.role) && ROLES[u.role].level >= 1) || isTeacher(u.role) || u.role === "standing_admin");
export const canWriteChat = (u: UserLike | null | undefined, room: "executives" | "all") => {
  if (!u || u.status !== "active") return false;
  if (!u.role) return false;
  if (isTeacher(u.role)) return false;
  if (room === "executives") return canEnterExecutives(u);
  return true;
};
