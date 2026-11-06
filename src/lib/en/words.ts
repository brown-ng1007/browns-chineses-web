// Dữ liệu từ tiếng Anh. Hiện dùng bộ từ mẫu có sẵn trong code.
// Khi có bảng en_words trên Supabase, chỉ cần sửa hàm loadEnWords() bên dưới.

export interface EnWord {
  id: string;
  word: string;
  ipa: string;
  pos: string;
  vi: string[]; // các nghĩa tiếng Việt chấp nhận được, nghĩa đầu là nghĩa chính
  example: string; // câu ví dụ, phải chứa đúng dạng từ để dùng cho bài điền từ
  exampleVi: string;
  world: number;
}

export interface EnWorld {
  id: number;
  name: string;
  tag: string;
  emoji: string;
}

export const EN_WORLDS: EnWorld[] = [
  { id: 1, name: "Hằng ngày", tag: "B1", emoji: "🌳" },
  { id: 2, name: "Công sở", tag: "TOEIC", emoji: "🏢" },
  { id: 3, name: "Học thuật", tag: "IELTS", emoji: "🎓" },
];

// [từ, IPA, loại từ, nghĩa (cách nhau bằng ;), ví dụ, nghĩa ví dụ]
type Row = [string, string, string, string, string, string];

const SEED: Record<number, Row[]> = {
  1: [
    ["achieve", "/əˈtʃiːv/", "v.", "đạt được;hoàn thành", "You can achieve anything if you work hard.", "Bạn có thể đạt được mọi thứ nếu chăm chỉ."],
    ["borrow", "/ˈbɒrəʊ/", "v.", "mượn", "Can I borrow your pen?", "Mình mượn bút của bạn được không?"],
    ["discuss", "/dɪˈskʌs/", "v.", "thảo luận;bàn bạc", "We need to discuss the plan.", "Chúng ta cần thảo luận về kế hoạch."],
    ["environment", "/ɪnˈvaɪrənmənt/", "n.", "môi trường", "We must protect the environment.", "Chúng ta phải bảo vệ môi trường."],
    ["experience", "/ɪkˈspɪəriəns/", "n.", "kinh nghiệm;trải nghiệm", "She has a lot of experience.", "Cô ấy có rất nhiều kinh nghiệm."],
    ["improve", "/ɪmˈpruːv/", "v.", "cải thiện;nâng cao", "I want to improve my English.", "Mình muốn cải thiện tiếng Anh."],
    ["opinion", "/əˈpɪnjən/", "n.", "ý kiến;quan điểm", "In my opinion, it is a good idea.", "Theo ý kiến của mình, đó là ý hay."],
    ["prepare", "/prɪˈpeə(r)/", "v.", "chuẩn bị", "I need to prepare for the exam.", "Mình cần chuẩn bị cho kỳ thi."],
    ["reduce", "/rɪˈdjuːs/", "v.", "giảm;cắt giảm", "We should reduce plastic waste.", "Chúng ta nên giảm rác thải nhựa."],
    ["suggest", "/səˈdʒest/", "v.", "đề xuất;gợi ý", "I suggest we leave early.", "Mình đề xuất chúng ta đi sớm."],
    ["valuable", "/ˈvæljuəbl/", "adj.", "quý giá;có giá trị", "Time is valuable.", "Thời gian rất quý giá."],
    ["crowded", "/ˈkraʊdɪd/", "adj.", "đông đúc", "The train was very crowded.", "Chuyến tàu rất đông."],
    ["attitude", "/ˈætɪtjuːd/", "n.", "thái độ", "A positive attitude helps a lot.", "Thái độ tích cực giúp ích rất nhiều."],
    ["recommend", "/ˌrekəˈmend/", "v.", "giới thiệu;đề xuất", "Can you recommend a good restaurant?", "Bạn giới thiệu giúp mình một nhà hàng ngon được không?"],
    ["comfortable", "/ˈkʌmftəbl/", "adj.", "thoải mái", "This chair is very comfortable.", "Chiếc ghế này rất thoải mái."],
  ],
  2: [
    ["appointment", "/əˈpɔɪntmənt/", "n.", "cuộc hẹn", "I have an appointment at ten.", "Mình có cuộc hẹn lúc mười giờ."],
    ["deadline", "/ˈdedlaɪn/", "n.", "hạn chót", "The deadline is next Friday.", "Hạn chót là thứ Sáu tuần sau."],
    ["invoice", "/ˈɪnvɔɪs/", "n.", "hóa đơn", "Please send me the invoice.", "Vui lòng gửi cho tôi hóa đơn."],
    ["colleague", "/ˈkɒliːɡ/", "n.", "đồng nghiệp", "My colleague will help you.", "Đồng nghiệp của tôi sẽ giúp bạn."],
    ["schedule", "/ˈʃedjuːl/", "n.", "lịch trình;thời gian biểu", "Check the schedule before you go.", "Hãy xem lịch trình trước khi đi."],
    ["supervisor", "/ˈsuːpəvaɪzə(r)/", "n.", "người giám sát;quản lý trực tiếp", "Ask your supervisor for approval.", "Hãy xin quản lý trực tiếp phê duyệt."],
    ["purchase", "/ˈpɜːtʃəs/", "v.", "mua;mua hàng", "We plan to purchase new computers.", "Chúng tôi dự định mua máy tính mới."],
    ["refund", "/ˈriːfʌnd/", "n.", "tiền hoàn lại;hoàn tiền", "I would like a refund.", "Tôi muốn được hoàn tiền."],
    ["negotiate", "/nɪˈɡəʊʃieɪt/", "v.", "đàm phán;thương lượng", "They will negotiate the contract.", "Họ sẽ đàm phán hợp đồng."],
    ["attach", "/əˈtætʃ/", "v.", "đính kèm", "Please attach the file to your email.", "Vui lòng đính kèm tệp vào email."],
    ["confirm", "/kənˈfɜːm/", "v.", "xác nhận", "Please confirm your reservation.", "Vui lòng xác nhận đặt chỗ."],
    ["revenue", "/ˈrevənjuː/", "n.", "doanh thu", "Our revenue grew this year.", "Doanh thu của chúng tôi tăng trong năm nay."],
    ["approve", "/əˈpruːv/", "v.", "phê duyệt;chấp thuận", "The manager will approve the budget.", "Quản lý sẽ phê duyệt ngân sách."],
    ["client", "/ˈklaɪənt/", "n.", "khách hàng", "We have a meeting with a client.", "Chúng tôi có cuộc họp với một khách hàng."],
    ["delay", "/dɪˈleɪ/", "n.", "sự chậm trễ", "There was a delay at the airport.", "Đã có sự chậm trễ ở sân bay."],
  ],
  3: [
    ["analyse", "/ˈænəlaɪz/", "v.", "phân tích", "Scientists analyse the data carefully.", "Các nhà khoa học phân tích dữ liệu cẩn thận."],
    ["significant", "/sɪɡˈnɪfɪkənt/", "adj.", "đáng kể;quan trọng", "There was a significant increase.", "Đã có mức tăng đáng kể."],
    ["evidence", "/ˈevɪdəns/", "n.", "bằng chứng", "There is no evidence for this claim.", "Không có bằng chứng cho nhận định này."],
    ["factor", "/ˈfæktə(r)/", "n.", "yếu tố", "Price is an important factor.", "Giá cả là một yếu tố quan trọng."],
    ["trend", "/trend/", "n.", "xu hướng", "The trend is going up.", "Xu hướng đang đi lên."],
    ["contrast", "/ˈkɒntrɑːst/", "n.", "sự tương phản;sự khác biệt", "There is a clear contrast between the two.", "Có sự tương phản rõ rệt giữa hai thứ."],
    ["approach", "/əˈprəʊtʃ/", "n.", "cách tiếp cận;phương pháp", "We need a new approach.", "Chúng ta cần một cách tiếp cận mới."],
    ["concept", "/ˈkɒnsept/", "n.", "khái niệm", "This concept is hard to explain.", "Khái niệm này khó giải thích."],
    ["estimate", "/ˈestɪmeɪt/", "v.", "ước tính", "Experts estimate the cost at ten million.", "Các chuyên gia ước tính chi phí là mười triệu."],
    ["interpret", "/ɪnˈtɜːprɪt/", "v.", "diễn giải;giải thích", "How do you interpret these results?", "Bạn diễn giải những kết quả này thế nào?"],
    ["consequence", "/ˈkɒnsɪkwəns/", "n.", "hậu quả;kết quả", "Every action has a consequence.", "Mỗi hành động đều có hậu quả."],
    ["reliable", "/rɪˈlaɪəbl/", "adj.", "đáng tin cậy", "This source is reliable.", "Nguồn này đáng tin cậy."],
    ["ensure", "/ɪnˈʃʊə(r)/", "v.", "đảm bảo", "We must ensure the results are accurate.", "Chúng ta phải đảm bảo kết quả chính xác."],
    ["emphasise", "/ˈemfəsaɪz/", "v.", "nhấn mạnh", "The report will emphasise safety.", "Báo cáo sẽ nhấn mạnh sự an toàn."],
    ["potential", "/pəˈtenʃl/", "adj.", "tiềm năng", "There is potential for growth.", "Có tiềm năng tăng trưởng."],
  ],
};

export const SEED_WORDS: EnWord[] = Object.entries(SEED).flatMap(([w, rows]) =>
  rows.map((r, i) => ({
    id: `w${w}-${i + 1}`,
    word: r[0],
    ipa: r[1],
    pos: r[2],
    vi: r[3].split(";"),
    example: r[4],
    exampleVi: r[5],
    world: Number(w),
  }))
);

export async function loadEnWords(): Promise<EnWord[]> {
  return SEED_WORDS;
}
