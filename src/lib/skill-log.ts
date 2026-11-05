import { createClient } from "@/lib/supabase/client";

/**
 * Ghi một lượt luyện vào skill_logs để tab Kỹ năng có số liệu.
 * minutes phải > 0 (ràng buộc của cơ sở dữ liệu), accuracy trong 0-1.
 * Lỗi (mất mạng, thiếu quyền ghi) thì bỏ qua, không làm gián đoạn việc học.
 */
export async function logSkill(
  skill: "listening" | "speaking",
  minutes: number,
  accuracy: number | null
): Promise<void> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return;
    await supabase.from("skill_logs").insert({
      user_id: uid,
      skill,
      minutes: Math.max(0.05, Math.round(minutes * 100) / 100),
      accuracy:
        accuracy === null ? null : Math.min(1, Math.max(0, accuracy)),
    });
  } catch {
    // bỏ qua
  }
}
