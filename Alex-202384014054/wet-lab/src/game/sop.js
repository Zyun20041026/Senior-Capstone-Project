// Alex 202384014054
// SOP violations. Each has a severity, a score penalty and the reason the rule
// exists (shown on the knowledge card when it fires and in the debrief).

import { EASE } from './difficulty.js';

export const RULES = {
  bsc_not_ready: { sev: 'major', pen: 12, text: '安全柜风机运行不足 5 分钟就开始无菌操作', why: '风机启动后需要几分钟才能在工作区形成稳定的下沉层流，过早操作时柜内空气还没有被 HEPA 过滤的气流置换。' },
  bsc_off: { sev: 'major', pen: 15, text: '安全柜风机没开就打开了无菌容器', why: '没有层流时，生物安全柜只是一个敞开的柜子，既不保护样品，也不保护操作者。' },
  bsc_uv: { sev: 'major', pen: 10, text: '紫外灯开着时操作', why: '紫外线会灼伤皮肤和角膜，也会破坏培养基和细胞。紫外灯只在无人操作时用于消毒，操作前必须关闭。' },
  bsc_not_wiped: { sev: 'minor', pen: 4, text: '台面没有先用 75% 酒精擦拭', why: '75% 乙醇的含水量让它能穿透细胞壁使蛋白变性，杀菌效果比无水乙醇好。开始前擦拭台面去除上次残留的污染。' },
  unsprayed_in: { sev: 'minor', pen: 3, cap: 9, text: '物品没喷 75% 酒精就放进安全柜', why: '瓶身、管壁在冰箱和水浴里会沾上微生物；放入安全柜前喷洒擦拭，避免把污染带进无菌区。水浴锅里拿出来的瓶子尤其要擦干。' },
  open_outside: { sev: 'major', pen: 15, text: '在安全柜外打开无菌容器', why: '实验室空气里有大量细菌和真菌孢子，无菌试剂和细胞只能在安全柜的层流区内开盖。' },
  open_carry_out: { sev: 'major', pen: 15, text: '敞口容器被带出安全柜', why: '离开层流区的敞口容器直接暴露在室内空气中。离开前必须盖好。' },
  tip_nonsterile: { sev: 'major', pen: 10, text: '用非无菌枪头接触了无菌液体', why: '枪头一旦离开安全柜、碰到非无菌表面，或来自在柜外打开的枪头盒，就不再无菌。' },
  dirty_tip_stock: { sev: 'major', pen: 12, text: '用过的枪头伸进了试剂原液', why: '原液要供整个实验室反复使用。用过的枪头会把细胞、药物或微生物带进原液，污染之后每一个用它的实验。' },
  cross_tip: { sev: 'minor', pen: 4, cap: 12, text: '同一个枪头先后接触了不同液体', why: '枪头内壁会挂一层液膜。换液体不换枪头，上一种液体就被带进下一种里，药物浓度梯度尤其敏感。' },
  spill: { sev: 'minor', pen: 3, cap: 9, text: '液体洒在了台面上', why: '打液时枪头必须在容器内。洒在安全柜台面上的培养液会成为微生物的营养源。' },
  second_stop_asp: { sev: 'minor', pen: 4, cap: 12, text: '吸液时把活塞按到了第二档', why: '第二档是吹出档。吸液前按到第二档，松开时会多吸进吹出行程那部分体积，常见误差 10–20%。' },
  press_in_liquid: { sev: 'minor', pen: 2, cap: 6, text: '枪头已在液面下才按压活塞', why: '应该在液面上方先压到第一档，再浸入液面下 2–3 mm 缓慢松开。在液面下按压会吹出气泡。' },
  aid_filter: { sev: 'major', pen: 8, text: '液体吸进了电动移液器滤芯', why: '超过移液管容量继续吸，液体会冲进移液器的疏水滤膜，污染移液器，之后用它的所有试剂都有风险。' },
  scrape_cells: { sev: 'minor', pen: 5, cap: 10, text: '吸液头碰到了贴壁细胞层', why: '吸弃培养基时应把吸头放在瓶角或瓶颈下方，不要接触培养面，否则会把细胞一起吸走。' },
  pellet_lost: { sev: 'major', pen: 10, text: '吸走了细胞沉淀', why: '离心后的细胞沉淀很松散。吸上清时吸头应停在液面附近并随液面下降，在沉淀上方留少量液体。' },
  cells_dry: { sev: 'minor', pen: 5, text: '贴壁细胞在无液体状态下放置过久', why: '吸掉培养基后细胞层会在几分钟内干燥死亡，下一种液体要尽快加入。' },
  over_trypsin: { sev: 'minor', pen: 5, text: '胰酶消化时间过长', why: '0.25% 胰酶在 37 °C 下 3–5 分钟足以让 PC-9 脱落。消化过久会损伤细胞膜表面蛋白，降低活率和贴壁能力。' },
  no_neutralize: { sev: 'major', pen: 8, text: '胰酶没有用含血清培养基充分终止', why: '血清中的 α1-抗胰蛋白酶能抑制胰酶。一般加入至少 2 倍体积的完全培养基。' },
  imbalance: { sev: 'major', pen: 10, text: '离心机没有配平', why: '对称位置的离心管质量必须相等（差值在 0.1 g 量级）。不平衡会让转子剧烈振动，损坏离心机甚至造成事故。' },
  open_in_centrifuge: { sev: 'major', pen: 8, text: '离心管没盖就离心', why: '离心会产生气溶胶，敞口离心既污染样品，也可能让操作者吸入生物材料。' },
  cold_medium: { sev: 'minor', pen: 2, cap: 4, text: '没有预热的培养基直接加到细胞上', why: '4 °C 的培养基会让细胞受冷应激。使用前在 37 °C 水浴中预热。' },
  incubator_door: { sev: 'minor', pen: 2, text: '培养箱门开着太久', why: '开门会让箱内温度和 CO₂ 浓度下降，恢复要十几分钟，影响箱内所有人的细胞。' },
  fridge_door: { sev: 'minor', pen: 1, text: '冰箱门开着太久', why: '冰箱门长时间开启会让试剂升温，加速血清和谷氨酰胺的降解。' },
  plate_in_bath: { sev: 'major', pen: 6, text: '细胞培养瓶或板放进了水浴锅', why: '水浴锅的水是微生物的温床，只能放密封的试剂瓶，而且要在液面以上。' },
  vortex_cells: { sev: 'minor', pen: 3, text: '涡旋振荡细胞悬液', why: '涡旋的剪切力会损伤细胞，细胞悬液用移液管轻轻吹打混匀。' },
  vortex_open: { sev: 'minor', pen: 4, text: '没盖盖子就涡旋', why: '开盖涡旋会把液体甩出来。' },
  dmso_unmixed: { sev: 'minor', pen: 3, text: '冻存母液解冻后没有混匀就取用', why: 'DMSO 溶液冻融后会分层，解冻后应涡旋混匀并短暂离心，否则取出的浓度不准。' },
  out_too_long: { sev: 'minor', pen: 4, text: '细胞离开培养箱时间过长', why: '室温和空气中的 pH 变化会让细胞状态下降。传代操作应在半小时左右完成。' },
  spray_open: { sev: 'minor', pen: 4, text: '对着敞口容器喷酒精', why: '酒精雾滴会落进培养液，乙醇对细胞有毒。' },
  sample_unmixed: { sev: 'minor', pen: 3, cap: 9, text: '取细胞悬液前没有混匀', why: '细胞几分钟内就会沉降。计数和铺板前都要轻轻吹打混匀，否则每次取样的细胞数都不一样。' },
  tips_outside: { sev: 'minor', pen: 3, text: '在安全柜外打开了无菌枪头盒', why: '枪头盒在柜外打开后，里面所有枪头都不再无菌。' },
  light_cck8: { sev: 'minor', pen: 2, text: 'CCK-8 孵育时未避光', why: 'WST-8 在光照下会自发还原，背景吸光度升高。' },
  wrong_wavelength: { sev: 'minor', pen: 3, text: '读板波长选错', why: 'CCK-8 的产物 WST-8 甲臜在 450 nm 附近吸收最强，其它波长信号很弱。' },
  cck_volume: { sev: 'minor', pen: 3, text: 'CCK-8 加入量不对', why: '说明书按每 100 µL 培养液加 10 µL。孔内液体是 150 µL，就应加 15 µL。' },
  overfill_hemo: { sev: 'minor', pen: 2, text: '计数板加样过多溢出到沟槽', why: '计数池深度 0.1 mm，加样过多会把盖玻片顶起，深度变化导致计数偏高。约 10 µL 即可。' },
};

export function violate(w, id, detail = '') {
  const r = RULES[id];
  if (!r) return;
  const rec = w.sop.counts[id] || (w.sop.counts[id] = { n: 0, pen: 0 });
  rec.n++;
  const pen = r.pen * EASE.penalty, cap = (r.cap ?? r.pen) * EASE.penalty;
  const add = Math.max(0, Math.min(pen, cap - rec.pen));
  rec.pen += add;
  w.sop.list.push({ id, t: w.t, detail });
  w.events.push({ kind: r.sev === 'major' ? 'error' : 'warn', text: r.text, detail, rule: id, first: rec.n === 1 });
}

export const penalty = (w) => Object.values(w.sop.counts).reduce((s, r) => s + r.pen, 0);
