import { DemoStorage } from "./storage";
import { filenameFor, fold } from "../domain/notes";
import sampleImageUrl from "../assets/demo-thinking.png";

export const richDemoTitle = "직접 고쳐 보는 생각의 지도";
export const richDemoSeedKey = "granite.demo.seed.rich-content.v1";

function exampleBody(image: string) {
  return `글의 모양을 바꾸면서 생각을 다듬어 보세요. 이 노트는 마음껏 고쳐도 됩니다. 바꾼 내용은 데모에 남습니다.

이미지·수식·다이어그램을 클릭하면 그 자리에서 원문을 고칠 수 있어요. 다른 문장으로 커서를 옮기면 다시 표현됩니다. 상단의 **원문** 버튼으로 모든 문법을 한꺼번에 볼 수도 있습니다.

## 장면을 한 장으로 남기기

![조각을 모으고 연결해 한 편의 글로 만드는 세 단계](${image})

위 그림은 ‘수집 → 연결 → 쓰기’를 나타냅니다. 원문에서 이미지 설명을 내 말로 바꿔 보세요. 직접 준비한 이미지를 본문에 붙여넣을 수도 있습니다.

## 작은 습관을 수식으로 생각하기

하루에 $n$개의 생각을 적고 $d$일 동안 이어 가면, 모은 조각은 $N = n \\times d$개입니다.

$$
N = \\sum_{i=1}^{7} n_i
$$

위 수식의 7을 30으로 바꿔 한 달의 기록을 상상해 보세요. 수식은 계산기가 아니라 생각을 표현하는 문장입니다.

## 반복하는 일을 코드로 적기

아래 JavaScript의 숫자를 바꾸거나 문장을 추가해 보세요. 코드는 실행되지 않고 언어에 맞는 색으로 표시됩니다.

\`\`\`javascript
const thoughtsPerDay = 3;
const days = 7;
const total = thoughtsPerDay * days;
console.log(\`일주일 동안 모은 생각: \${total}개\`);
\`\`\`

같은 생각을 Python으로 적으면 이런 모습입니다.

\`\`\`python
thoughts = ["산책", "질문", "책 속 문장"]
for thought in thoughts:
    print(f"오늘의 조각: {thought}")
\`\`\`

## 다음 문장으로 이어지는 길

\`\`\`mermaid
flowchart LR
    A[조각 수집] --> B[질문 찾기]
    B --> C[짧은 글 쓰기]
    C --> A
\`\`\`

그림을 클릭해 ‘질문 찾기’를 ‘산책하기’로 바꿔 보세요. 내 생각의 순서에 맞게 화살표를 추가해도 좋습니다.

이제 [[덤프]]에 오늘의 조각을 남기거나, 이 노트 아래에 나만의 예시를 이어 써 보세요.
`;
}

async function seedRichExample(s: DemoStorage) {
  const saved = localStorage.getItem(richDemoSeedKey);
  const state: { title: string; complete: boolean } | null = saved
    ? JSON.parse(saved)
    : null;
  if (state?.complete) return;
  const notes = await s.list();
  // A pending filename is a recovery journal: never replace content committed
  // before a failed marker write (or another writer's intervening content).
  if (
    state &&
    notes.some((note) => note.filename === filenameFor(state.title))
  ) {
    localStorage.setItem(
      richDemoSeedKey,
      JSON.stringify({ ...state, complete: true }),
    );
    return;
  }
  let title = state?.title ?? richDemoTitle;
  let suffix = 2;
  while (
    notes.some(
      (note) =>
        fold(note.title) === fold(title) ||
        fold(note.filename) === fold(filenameFor(title)),
    )
  ) {
    title = `${richDemoTitle} (${suffix++})`;
  }
  const response = await fetch(sampleImageUrl);
  if (!response.ok) throw Error("데모 예시 이미지를 불러오지 못했습니다.");
  const image = await s.putImage(await response.blob());
  localStorage.setItem(
    richDemoSeedKey,
    JSON.stringify({ title, complete: false }),
  );
  await s.create(title, exampleBody(image));
  localStorage.setItem(
    richDemoSeedKey,
    JSON.stringify({ title, complete: true }),
  );
}

let opening: Promise<unknown> = Promise.resolve();
export async function openDemo() {
  const open = () => openSeededDemo();
  if (navigator.locks)
    return navigator.locks.request("granite:demo-seeding", open);
  const result = opening.catch(() => {}).then(open);
  opening = result;
  return result;
}
async function openSeededDemo() {
  const s = new DemoStorage();
  if (localStorage.getItem(DemoStorage.key) === null) {
    await s.create(
      "생각을 연결하는 작은 습관",
      `메모는 완성된 생각의 기록이 아니라, 생각이 시작되는 자리일지도 모릅니다.\n\n## 흩어진 조각에서 시작하기\n\n책을 읽다가 밑줄 친 문장, 산책하며 떠오른 질문, 아직 이름 붙이지 못한 아이디어. 우선 [[덤프]]에 가볍게 내려놓아 보세요.\n\n**정리보다 먼저, 수집.** 충분히 쌓인 조각에서 한 가지 생각을 골라 자기만의 노트로 옮깁니다. 서로의 연결이 서서히 보이기 시작합니다.\n\n## 작은 연결 하나\n\n좋은 질문은 종종 다른 질문으로 이어집니다. [[좋은 질문을 모으는 일]]처럼요. \`[[이건 코드 예시]]\`는 연결되지 않습니다.\n\n**새 노트**를 만들고 생각을 적어 보세요. \`[[노트 제목]]\`으로 서로의 연결을 남길 수 있습니다.\n\n> 서두르지 않아도 괜찮아요. 오늘의 생각을 한 줄 남기는 것부터.\n\n[디지털 정원에 관하여](https://maggieappleton.com/garden-history)`,
    );
    await s.create(
      "좋은 질문을 모으는 일",
      `답을 모으는 대신, 오래 붙잡고 싶은 질문을 모읍니다.\n\n- 나는 어떤 생각을 자꾸 되풀이할까?\n- 최근에 마음을 바꾼 순간은 언제였을까?\n- 이 생각은 어디에서 왔을까?\n\n[[생각을 연결하는 작은 습관]]으로 돌아가 보면, 질문도 작은 조각에서 시작합니다.`,
    );
    await s.create(
      "덤프",
      `## 아직 이름 없는 생각들\n\n서로 관계없어 보이는 두 생각을 나란히 놓아 보기.\n\n나중에 읽을 글, 한 문장 메모, 어딘가에서 주운 질문을 이곳에 모아 둡니다.\n\n정리되지 않은 채로도 충분합니다.`,
    );
    await s.create(
      "산책과 생각의 속도",
      `걷는 속도로 생각하면, 놓쳤던 것이 보입니다.\n\n오늘 산책에서 발견한 것:\n\n- 골목 끝 작은 나무의 계절\n- 목적 없이 걷는 시간의 여유\n- 어떤 문장은 책상 밖에서 완성된다는 것`,
    );
  }
  await seedRichExample(s);
  return s;
}
