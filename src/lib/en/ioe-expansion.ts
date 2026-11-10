/**
 * 29 dạng luyện tập mở rộng theo các nhóm kỹ năng thường gặp trong IOE.
 * Đây là nội dung luyện tập tự biên soạn theo định dạng, không sao chép đề thi thật.
 */
export type IoeQuestionKind = "choice" | "listen" | "order" | "input" | "binary" | "stress";

export interface IoeExpandedGame {
  id: string;
  title: string;
  vi: string;
  category: "Listening" | "Pronunciation" | "Vocabulary" | "Grammar" | "Communication" | "Reading";
  icon: string;
  color: string;
  scene: string;
  thumb: string;
  desc: string;
  kind: IoeQuestionKind;
  prompt: string;
  subPrompt?: string;
  options?: string[];
  answer: string;
  speakText?: string;
  tokens?: string[];
  explain: string;
}

export const IOE_EXPANSION: IoeExpandedGame[] = [
  {
    id: "listen-one", title: "Listen & Choose", vi: "Nghe từ – chọn đáp án", category: "Listening", icon: "🎧", color: "cyan", scene: "audio", thumb: "pair",
    desc: "Nghe một từ tiếng Anh rồi chọn đúng từ hoặc nghĩa tương ứng.", kind: "listen", prompt: "Nghe kỹ từ được đọc và chọn từ bạn nghe thấy.", speakText: "schedule", options: ["schedule", "school", "student", "subject"], answer: "schedule", explain: "Schedule /ˈʃedjuːl/ nghĩa là lịch trình hoặc thời gian biểu."
  },
  {
    id: "listen-sentence", title: "Listen to the Sentence", vi: "Nghe câu – hiểu ý", category: "Listening", icon: "🔊", color: "cyan", scene: "audio", thumb: "exam",
    desc: "Nghe một câu hoàn chỉnh và chọn nội dung đúng.", kind: "listen", prompt: "Nghe câu và chọn nghĩa tiếng Việt phù hợp.", speakText: "The library closes at five o'clock.", options: ["Thư viện đóng cửa lúc năm giờ.", "Thư viện mở cửa lúc bảy giờ.", "Hiệu sách đóng cửa lúc năm giờ.", "Lớp học bắt đầu lúc năm giờ."], answer: "Thư viện đóng cửa lúc năm giờ.", explain: "Closes at five o'clock = đóng cửa lúc năm giờ."
  },
  {
    id: "phoneme-odd", title: "Sound Detective", vi: "Tìm từ phát âm khác", category: "Pronunciation", icon: "🕵️", color: "violet", scene: "sound", thumb: "climb",
    desc: "Nhận diện âm nguyên âm khác biệt trong nhóm từ.", kind: "choice", prompt: "Chọn từ có phần in hoa phát âm khác ba từ còn lại.", subPrompt: "A. hEA d · B. brEA d · C. grEA t · D. wEA ther", options: ["head", "bread", "great", "weather"], answer: "great", explain: "Great có âm /eɪ/, các từ còn lại có âm /e/."
  },
  {
    id: "ending-sound", title: "Ending Sound Race", vi: "Phân biệt đuôi -s / -es", category: "Pronunciation", icon: "🏁", color: "violet", scene: "sound", thumb: "extra",
    desc: "Phân biệt cách phát âm đuôi số nhiều -s/-es.", kind: "choice", prompt: "Từ nào có đuôi -s phát âm là /ɪz/?", options: ["books", "bags", "classes", "cups"], answer: "classes", explain: "Classes kết thúc bằng âm /ɪz/; books, cups là /s/ và bags là /z/."
  },
  {
    id: "word-stress", title: "Stress Mountain", vi: "Chinh phục trọng âm", category: "Pronunciation", icon: "⛰️", color: "rose", scene: "climb", thumb: "climb",
    desc: "Chọn âm tiết được nhấn trong từ tiếng Anh.", kind: "stress", prompt: "Từ BANANA có trọng âm rơi vào âm tiết thứ mấy?", subPrompt: "ba · NA · na", options: ["Âm tiết 1", "Âm tiết 2", "Âm tiết 3"], answer: "Âm tiết 2", explain: "Banana được phát âm /bəˈnɑː.nə/, trọng âm ở âm tiết thứ hai."
  },
  {
    id: "odd-one-out", title: "Odd One Out", vi: "Chọn từ khác nhóm", category: "Vocabulary", icon: "🧩", color: "mint", scene: "school", thumb: "pair",
    desc: "Tìm từ không cùng chủ đề hoặc từ loại.", kind: "choice", prompt: "Choose the word that does NOT belong to the group.", subPrompt: "apple · banana · carrot · orange", options: ["apple", "banana", "carrot", "orange"], answer: "carrot", explain: "Carrot là rau củ; các từ còn lại là trái cây."
  },
  {
    id: "synonym-hunt", title: "Synonym Hunt", vi: "Săn từ đồng nghĩa", category: "Vocabulary", icon: "🔍", color: "mint", scene: "search", thumb: "extra",
    desc: "Tìm từ có nghĩa gần nhất với từ cho trước.", kind: "choice", prompt: "Choose the closest meaning of RAPID.", options: ["slow", "quick", "weak", "quiet"], answer: "quick", explain: "Rapid và quick đều có nghĩa là nhanh."
  },
  {
    id: "antonym-duel", title: "Antonym Duel", vi: "Đấu trường trái nghĩa", category: "Vocabulary", icon: "⚔️", color: "amber", scene: "duel", thumb: "cannon",
    desc: "Chọn từ có nghĩa trái ngược với từ đã cho.", kind: "choice", prompt: "Choose the opposite of GENEROUS.", options: ["kind", "selfish", "helpful", "friendly"], answer: "selfish", explain: "Generous là hào phóng; selfish là ích kỷ."
  },
  {
    id: "definition-match", title: "Definition Match", vi: "Đoán từ qua định nghĩa", category: "Vocabulary", icon: "📖", color: "blue", scene: "book", thumb: "pair",
    desc: "Đọc định nghĩa ngắn để tìm đúng từ vựng.", kind: "choice", prompt: "A place where you can borrow books is a _____.", options: ["library", "stadium", "factory", "restaurant"], answer: "library", explain: "A library là thư viện – nơi bạn có thể mượn sách."
  },
  {
    id: "word-class", title: "Word Class Sorter", vi: "Nhận diện từ loại", category: "Vocabulary", icon: "🗂️", color: "blue", scene: "school", thumb: "rearrange",
    desc: "Phân biệt danh từ, động từ, tính từ và trạng từ.", kind: "choice", prompt: "Which word is a VERB?", options: ["beautiful", "carefully", "approve", "decision"], answer: "approve", explain: "Approve là động từ, nghĩa là phê duyệt hoặc chấp thuận."
  },
  {
    id: "spelling-bee", title: "Spelling Bee", vi: "Ong vàng đánh vần", category: "Vocabulary", icon: "🐝", color: "amber", scene: "letters", thumb: "extra",
    desc: "Nghe hoặc đọc gợi ý rồi tự nhập cách viết đúng.", kind: "input", prompt: "Spell the word: the natural world around us.", subPrompt: "Gợi ý: môi trường", answer: "environment", explain: "Environment = môi trường. Hãy chú ý thứ tự chữ n-m-e-n-t ở cuối từ."
  },
  {
    id: "missing-vowels", title: "Vowel Rescue", vi: "Cứu nguyên âm", category: "Vocabulary", icon: "🔤", color: "blue", scene: "letters", thumb: "climb",
    desc: "Điền các nguyên âm còn thiếu để hoàn thành từ.", kind: "input", prompt: "Complete the word: c_mf_rt_bl_", subPrompt: "Nghĩa: thoải mái", answer: "comfortable", explain: "Comfortable được viết là c-o-m-f-o-r-t-a-b-l-e."
  },
  {
    id: "sentence-gap", title: "Sentence Gap", vi: "Điền từ vào câu", category: "Grammar", icon: "📝", color: "green", scene: "book", thumb: "rearrange",
    desc: "Chọn từ phù hợp để hoàn thiện câu.", kind: "choice", prompt: "She _____ to school by bus every morning.", options: ["go", "goes", "going", "went"], answer: "goes", explain: "Chủ ngữ She ở hiện tại đơn nên động từ thêm -es: goes."
  },
  {
    id: "verb-tense", title: "Tense Time Machine", vi: "Cỗ máy thì động từ", category: "Grammar", icon: "⏱️", color: "green", scene: "clock", thumb: "exam",
    desc: "Chọn đúng thì theo dấu hiệu thời gian.", kind: "choice", prompt: "Yesterday, they _____ to the park.", options: ["go", "goes", "went", "going"], answer: "went", explain: "Yesterday là dấu hiệu quá khứ đơn; go chuyển thành went."
  },
  {
    id: "article-choice", title: "Article Airport", vi: "Chọn mạo từ a / an / the", category: "Grammar", icon: "🛫", color: "green", scene: "plane", thumb: "climb",
    desc: "Chọn mạo từ phù hợp trước danh từ.", kind: "choice", prompt: "I saw _____ elephant at the zoo.", options: ["a", "an", "the", "—"], answer: "an", explain: "Elephant bắt đầu bằng âm nguyên âm nên dùng an."
  },
  {
    id: "preposition-path", title: "Preposition Path", vi: "Đường đua giới từ", category: "Grammar", icon: "🛣️", color: "green", scene: "path", thumb: "climb",
    desc: "Chọn giới từ đúng trong cụm từ và câu.", kind: "choice", prompt: "My sister is interested _____ music.", options: ["on", "at", "in", "for"], answer: "in", explain: "Cụm cố định là be interested in something."
  },
  {
    id: "pronoun-choice", title: "Pronoun Puzzle", vi: "Thám tử đại từ", category: "Grammar", icon: "🧑‍🤝‍🧑", color: "violet", scene: "dialogue", thumb: "pair",
    desc: "Chọn đại từ phù hợp với chủ ngữ hoặc tân ngữ.", kind: "choice", prompt: "Mai and I are friends. _____ study together.", options: ["We", "They", "She", "He"], answer: "We", explain: "Mai and I tương ứng với đại từ ngôi thứ nhất số nhiều We."
  },
  {
    id: "conjunction-bridge", title: "Conjunction Bridge", vi: "Cầu nối liên từ", category: "Grammar", icon: "🌉", color: "blue", scene: "bridge", thumb: "rearrange",
    desc: "Nối hai vế câu bằng liên từ thích hợp.", kind: "choice", prompt: "I was tired, _____ I finished my homework.", options: ["because", "but", "or", "so"], answer: "but", explain: "But diễn tả sự tương phản: mệt nhưng vẫn hoàn thành bài tập."
  },
  {
    id: "error-detective", title: "Error Detective", vi: "Thám tử tìm lỗi sai", category: "Grammar", icon: "🕵️", color: "rose", scene: "search", thumb: "extra",
    desc: "Chỉ ra từ hoặc cụm từ sai trong câu.", kind: "choice", prompt: "Find the incorrect part: She go to school every day.", options: ["She", "go", "to school", "every day"], answer: "go", explain: "She là ngôi thứ ba số ít, vì vậy phải dùng goes."
  },
  {
    id: "dialogue-reply", title: "Dialogue Café", vi: "Chọn câu đáp giao tiếp", category: "Communication", icon: "☕", color: "orange", scene: "dialogue", thumb: "octopus",
    desc: "Chọn lời đáp tự nhiên trong tình huống giao tiếp.", kind: "choice", prompt: "Would you like some tea?", options: ["Yes, please.", "I am twelve.", "It is on the table.", "At seven o'clock."], answer: "Yes, please.", explain: "Yes, please là lời đáp lịch sự khi đồng ý nhận lời mời."
  },
  {
    id: "dialogue-order", title: "Dialogue Builder", vi: "Sắp xếp hội thoại", category: "Communication", icon: "💬", color: "orange", scene: "dialogue", thumb: "rearrange",
    desc: "Sắp xếp các câu theo trình tự hội thoại tự nhiên.", kind: "order", prompt: "Put the conversation in the correct order.", tokens: ["Good morning!", "How are you?", "I'm fine, thank you."], answer: "Good morning!|How are you?|I'm fine, thank you.", explain: "Lời chào → hỏi thăm → trả lời."
  },
  {
    id: "reading-comprehension", title: "Reading Explorer", vi: "Đọc hiểu thám hiểm", category: "Reading", icon: "🧭", color: "blue", scene: "book", thumb: "exam",
    desc: "Đọc đoạn văn ngắn và tìm thông tin chính xác.", kind: "choice", prompt: "Read: “Tom usually goes to school by bicycle. His school is two kilometres from his house.” How does Tom go to school?", options: ["By bus", "On foot", "By bicycle", "By car"], answer: "By bicycle", explain: "Đoạn văn cho biết Tom usually goes to school by bicycle."
  },
  {
    id: "cloze-passage", title: "Cloze River", vi: "Điền khuyết đoạn văn", category: "Reading", icon: "🏞️", color: "cyan", scene: "river", thumb: "monkey",
    desc: "Điền từ còn thiếu dựa vào mạch nghĩa của đoạn văn.", kind: "choice", prompt: "Tom is a student. He _____ up at six every morning and has breakfast with his family.", options: ["get", "gets", "got", "getting"], answer: "gets", explain: "Chủ ngữ He ở hiện tại đơn: gets up."
  },
  {
    id: "sentence-rewrite", title: "Sentence Transformer", vi: "Biến đổi câu tương đương", category: "Grammar", icon: "🔁", color: "violet", scene: "transform", thumb: "rearrange",
    desc: "Chọn câu có nghĩa tương đương với câu gốc.", kind: "choice", prompt: "Choose the sentence closest in meaning to: You should get some rest.", options: ["It is a good idea for you to rest.", "You must not sleep.", "You finished resting yesterday.", "You are resting now."], answer: "It is a good idea for you to rest.", explain: "Should ở đây diễn tả lời khuyên, tương đương It is a good idea to…"
  },
  {
    id: "plural-quantifier", title: "Plural & Quantity", vi: "Số nhiều và lượng từ", category: "Grammar", icon: "🍎", color: "amber", scene: "fruit", thumb: "pair",
    desc: "Chọn lượng từ và dạng danh từ phù hợp.", kind: "choice", prompt: "There are _____ apples in the basket.", options: ["much", "many", "a little", "any of"], answer: "many", explain: "Apples là danh từ đếm được số nhiều; dùng many."
  },
  {
    id: "comparative-race", title: "Comparative Race", vi: "Đường đua so sánh", category: "Grammar", icon: "🏎️", color: "orange", scene: "race", thumb: "penalty",
    desc: "Dùng so sánh hơn hoặc nhất đúng ngữ cảnh.", kind: "choice", prompt: "A train is _____ than a bicycle.", options: ["fast", "faster", "fastest", "the faster"], answer: "faster", explain: "Có than nên dùng dạng so sánh hơn faster."
  },
  {
    id: "question-word", title: "Wh-question Wheel", vi: "Vòng quay từ để hỏi", category: "Grammar", icon: "❓", color: "blue", scene: "wheel", thumb: "exam",
    desc: "Chọn từ để hỏi phù hợp với câu trả lời.", kind: "choice", prompt: "_____ do you go to school? — By bus.", options: ["Where", "When", "How", "Who"], answer: "How", explain: "By bus trả lời cho câu hỏi về cách thức: How."
  },
  {
    id: "collocation-match", title: "Collocation Kitchen", vi: "Ghép cụm từ tự nhiên", category: "Vocabulary", icon: "🍳", color: "amber", scene: "kitchen", thumb: "pair",
    desc: "Chọn động từ thường đi với danh từ để tạo collocation.", kind: "choice", prompt: "Choose the correct collocation: _____ a decision.", options: ["do", "make", "take", "put"], answer: "make", explain: "Make a decision là cụm từ cố định: đưa ra quyết định."
  },
  {
    id: "sailor-rescue", title: "Sailor Rescue", vi: "Giải cứu thủy thủ", category: "Communication", icon: "⛵", color: "cyan", scene: "ship", thumb: "sea",
    desc: "Trả lời nhanh để đưa con tàu qua vùng biển an toàn.", kind: "choice", prompt: "The sailor _____ the life jacket before entering the sea.", options: ["wear", "wears", "wearing", "wore"], answer: "wears", explain: "The sailor là chủ ngữ số ít; ở hiện tại đơn dùng wears."
  }
];
