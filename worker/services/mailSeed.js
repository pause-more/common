import { stripHtml } from "../shared/utils.js";
import { getList, setList } from "../storage/kv.js";
import { setMailItem } from "../storage/mail.js";
import { toListItem } from "../storage/mailLists.js";

export async function ensureInboxSeed(env) {
  const inboxList = await getList(env, "inbox_list");
  if (inboxList.length) return;

  const samples = [
    { id: "inbox_" + Date.now() + "_1", folder: "inbox", to: "jinzero@autonecar.kr", from: "ceo@autonecar.kr", from_name: "대표이사", subject: "그룹웨어 테스트 메일입니다.", body: "<p>안녕하세요.</p><p>받은메일함 테스트용 첫 번째 메일입니다.</p>", date: new Date(Date.now() - 20 * 60 * 1000).toISOString(), unread: true, starred: false },
    { id: "inbox_" + Date.now() + "_2", folder: "inbox", to: "jinzero@autonecar.kr", from: "hr@autonecar.kr", from_name: "인사팀", subject: "근태 확인 요청", body: "<p>오늘 출근 기록을 확인해 주세요.</p>", date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), unread: true, starred: true }
  ];

  for (const sample of samples) {
    sample.snippet = stripHtml(sample.body).slice(0, 120);
    await setMailItem(env, sample);
    inboxList.push(toListItem(sample));
  }
  await setList(env, "inbox_list", inboxList);
}
