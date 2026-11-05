import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ViConfirmRequest, ViUserStatus } from "@/types/database.types";

/**
 * POST /api/vi/confirm
 * vào: { word_id, choice: "keep_mine" | "accept_candidate" | "merge", text }
 *
 * Lưu nghĩa Việt người dùng đã chốt vào vi_user (bảng riêng, không bị ghi đè
 * khi nạp lại dữ liệu nguồn). Dùng phiên đăng nhập của người dùng nên RLS có hiệu lực:
 * chỉ ghi được dòng có user_id = auth.uid().
 */

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 500;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_BY_CHOICE: Record<ViConfirmRequest["choice"], ViUserStatus> = {
  keep_mine: "own",
  accept_candidate: "accepted",
  merge: "merged",
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<ViConfirmRequest>;
  try {
    body = (await request.json()) as Partial<ViConfirmRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const wordId = typeof body.word_id === "string" ? body.word_id : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const choice = body.choice;

  if (!UUID_RE.test(wordId)) {
    return NextResponse.json({ error: "Invalid word_id" }, { status: 400 });
  }
  if (
    choice !== "keep_mine" &&
    choice !== "accept_candidate" &&
    choice !== "merge"
  ) {
    return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
  }
  if (text.length < 1 || text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `text phải từ 1 đến ${MAX_TEXT_LENGTH} ký tự` },
      { status: 400 }
    );
  }

  const status = STATUS_BY_CHOICE[choice];

  // deleted_at: null để khôi phục nếu dòng này từng bị xóa mềm
  const { error } = await supabase.from("vi_user").upsert(
    {
      user_id: user.id,
      word_id: wordId,
      text,
      status,
      deleted_at: null,
    },
    { onConflict: "user_id,word_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Không lưu được nghĩa" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status });
}
