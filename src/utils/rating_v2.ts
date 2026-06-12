// taiko-rating-calculator.ts
// 太鼓达人评分计算器
// 基于用户指定的计算规则，计算游戏《太鼓达人》中根据玩家成绩得到的rating值

// 需求文档：
// 调用以及输入要求：
// 需要调用曲目（songs）数据库，每首曲目包含的数据：id、难度（difficulty）、体力（stamina）、手速（handspeed）、爆发（burst）、复合（complex）、节奏（rhythm）、主定数（main_constant）、副定数1（sub_constant_1）、副定数2（sub_constant_2）。
// 以上这些数据，id是一个正整数，难度是0-4中的一个整数，其余数据的范围均为0-15.5。
// 需要输入玩家游玩的曲目对应id和难度。
// 需要输入玩家在该曲目中的准确率（accuracy_per）和不可率（bad_per），范围为0-1。
// 计算步骤：
// 1、将accuracy_per根据calculator文件中的calcY函数换算成一个0-15.5的数值，记为accuracy，算法类型使用“comprehensive”的部分。
// 2、根据id和难度，在songs数据库中找到对应的体力（stamina）、手速（handspeed）、爆发（burst）、复合（complex）、节奏（rhythm）、主定数（main_constant）、副定数1（sub_constant_1）、副定数2（sub_constant_2），用于后续的计算。
// 3、根据calculator文件中的calcSingleRating函数，计算以下值：
// (1)rt_90：参数分别为sub_constant_1和calcY(0.9)的计算结果
// (2)rt_95_ref：参数分别为sub_constant_1和calcY(0.95)的计算结果
// (3)rt_95：参数分别为main_constant和calcY(0.95)的计算结果
// (4)rt_100_ref：参数分别为main_constant和calcY(1)的计算结果
// (5)rt_100：参数分别为sub_constant_2和calcY(1)的计算结果
// 4、根据calculator文件中的calcSingleRating函数，计算值rt_ini，其中第一个参数的选择：当accuracy_per<=0.95时，使用sub_constant_1，否则使用main_constant。第二个参数使用accuracy。
// 5、计算rating：
// (1)当accuracy_per<=0.9时，rating=rt_ini
// (2)当0.9<accuracy_per<=0.95时，rating=rt_90+(rt_95-rt_90)*(rt_ini-rt_90)/(rt_95_ref-rt_90)
// (3)当accuracy_per>0.95时，rating=rt_95+(rt_100-rt_95)*(rt_ini-rt_95)/(rt_100_ref-rt_95)
// 6、计算其余维度rating：
// (1)体力rt：stamina_rt=sqrt(rating*stamina)
// (2)手速rt：handspeed_rt=sqrt(rating*handspeed)
// (3)爆发rt：burst_rt=sqrt(rating*burst)*min(rating/handspeed,1)
// (4)复合rt：complex_rt=sqrt(rating*complex)*(5000/9*power(max(0.03-bad_per,0),2)+0.5)
// (5)节奏rt：rhythm_rt=sqrt(rating*rhythm)*min(rating/handspeed,1)*min(burst_rt/burst,1)
// (6)精度rt：accuracy_rt=sqrt(rating*accuracy)
// 7、返回前两个步骤中共计7个计算结果

// 计算思路说明
// 和初版rt相比，主要改动：
// 1、引入“动态定数”的概念
// 在实际游玩时，对于不同阶段的成绩，曲目之间的相对难易度也会发生变化（比如按摩女、蚊子属于过关门槛高但全良相对简单，而里源平、蓝老鼠属于过关容易但高良与全良的难度非常高），只用一个难易度定数来涵盖所有成绩的表现是不准确也不现实的。因此，对于每个谱面，设置了3个定数：主定数与副定数1和2，他们分别代表准度95%、75%与接近100%（但并非全良，可以理解为99%准度，之所以不设置为全良难度是因为现有算法难以计算极端局所难（如远鼓2000）带来的影响。即使如此，该定数仍只能先使用一个通用公式给出估计值，之后仍需人工进行部分调整）。在良率前期，使用副定数1为基准计算的rt，而当准度在90%与95%之间时，rt会继续按照副定数1的计算结果上升，但需要按比例向末端为主定数、准度95%对应的rt值映射（例，若以副定数1为基准计算，90%准度时rt=5，93%准度时rt=6，95%准度时rt=7，而以主定数为基础计算95%准度时rt=6，那么93%准度时的实际rt为5.5）。准度在95%以上时的思路相似，不再赘述。
// 并且，由于“定数”不再是一个唯一的值，初版rt中的“大歌力”将取消，“高速力”将被细化为“手速”和“爆发”两部分，仍保持六维。
// 2、节奏、复合rt计算改变
// 节奏rt计算改变基于一个理论：在演奏谱面时，玩家需要克服的难点存在先后顺序：“先硬件，后软件”。首先需要克服手速，然后需要克服爆发，最后才是节奏处理。在初版rt中，可以观察到许多更倾向于“越级打大歌”的玩家，节奏rt往往比较高，而对于单曲而言，一首11.0（db定数）以上的歌曲，仅需95%不到的准度，往往能得到比高准度技术曲更高的节奏rt，这一现象是比较反直觉的。原因在于，高定数歌曲往往伴随着高节奏处理要求，并且不需要特别高的准度也可以取得比较可观的rt，但初版算法错误地认为这些难点的克服是并列顺序，并判断这个rt是由于对节奏处理的能力取得的，而实际上在该准度下基础的手速要求都尚未达到。从另一个角度考虑，节奏处理能力也需要在较高良率下才能体现。具体到计算中，节奏rt会在原本取几何平均的基础上，在手速、爆发rt达到指定阈值之前按百分比衰减。同样，新的维度爆发rt也会在手速rt达到阈值之前按百分比衰减。
// 复合这一维度由于侧重对复杂鱼蛋的换手能力考察，能否保持高连率也应该是一个额外的考量要素，因此会通过不可率来修正，不可率越高修正越低，当不可率超过3%时会折算为原本的50%。

// 导入相关类型和函数
import { calcY, calcSingleRating } from '@utils/calculator';

// 定义曲目数据类型
interface SongData {
  id: number;              // 曲目ID，正整数
  difficulty: number;      // 难度，0-4
  stamina: number;        // 体力，0-15.5
  handspeed: number;      // 手速，0-15.5
  burst: number;         // 爆发，0-15.5
  complex: number;       // 复合，0-15.5
  rhythm: number;        // 节奏，0-15.5
  main_constant: number;  // 主定数，0-15.5
  sub_constant_1: number; // 副定数1，0-15.5
  sub_constant_2: number; // 副定数2，0-15.5
}

// 定义计算输入参数
interface CalculationInput {
  id: number;           // 曲目ID
  difficulty: number;   // 难度
  accuracy_per: number; // 准确率，0-1
  bad_per: number;      // 不可率，0-1
}

// 定义计算中间量，用于调试/展示
interface CalculationIntermediate {
  burst_hs_factor: number;    // 爆发手速衰减因子，同时用于节奏
  complex_penalty: number;    // 复合不可率惩罚因子
  rhythm_burst_factor: number; // 节奏爆发衰减因子
}

// 定义计算结果，包含7个返回值 + 中间量
interface CalculationResult {
  rating: number;       // 综合rating
  stamina_rt: number;   // 体力rating
  handspeed_rt: number; // 手速rating
  burst_rt: number;     // 爆发rating
  complex_rt: number;   // 复合rating
  rhythm_rt: number;    // 节奏rating
  accuracy_rt: number;  // 精度rating
  intermediate: CalculationIntermediate; // 中间量
}

// 辅助函数常量
const SQRT = Math.sqrt;
const MAX = Math.max;
const MIN = Math.min;
const POWER = Math.pow;

/**
 * 根据曲目ID和难度查找曲目数据
 * @param songsDB 曲目数据库数组
 * @param id 曲目ID
 * @param difficulty 难度
 * @returns 匹配的曲目数据，未找到时返回null
 */
function findSongData(songsDB: SongData[], id: number, difficulty: number): SongData | null {
  return songsDB.find(song => song.id === id && song.difficulty === difficulty) || null;
}

/**
 * 计算单个维度的rating（使用几何平均）
 * 基于sqrt(rating * dimensionValue)公式
 * @param rating 综合rating值
 * @param dimensionValue 维度原始值
 * @returns 维度rating
 */
function calcDimensionRating(rating: number, dimensionValue: number): number {
  return SQRT(rating * dimensionValue);
}

/**
 * 计算单个维度的rating（使用对数插值）
 * 基于min/max分段 + ln插值 + 几何平均过渡的混合算法
 * @param rating 综合rating值
 * @param dimensionValue 维度原始值
 * @param accuracy 准确率换算后的accuracy值
 * @returns 维度rating
 */
function calcLnRating(rating: number, dimensionValue: number, accuracy: number): number {
  const base = MIN(rating, dimensionValue);
  const upper = MAX(rating, dimensionValue);

  if (dimensionValue <= rating) {
    // 维度值不超过rating时，使用对数插值
    return base + MIN(accuracy / dimensionValue, 1) * Math.log(upper - base + 1);
  } else {
    // 维度值超过rating时，rt1用对数插值，rt2用几何平均，按accuracy做加权平均
    const rt1 = base + MIN(accuracy / dimensionValue, 1) * Math.log(upper - base + 1);
    const rt2 = SQRT(base * upper);

    let w1: number;
    let w2: number;
    if (accuracy <= rating) {
      w1 = 1;
      w2 = 0;
    } else if (accuracy >= dimensionValue) {
      w1 = 0;
      w2 = 1;
    } else {
      w1 = (accuracy - rating) / (dimensionValue - rating);
      w2 = (dimensionValue - accuracy) / (dimensionValue - rating);
    }

    return rt1 * w1 + rt2 * w2;
  }
}

/**
 * 主计算函数：计算太鼓达人评分
 * 按照用户指定的计算步骤，基于玩家成绩计算7个维度的rating值
 * 
 * 计算步骤：
 * 1. 将accuracy_per根据calcY函数换算成accuracy值
 * 2. 查找曲目数据获取各维度值
 * 3. 计算5个参考rating值
 * 4. 根据accuracy_per选择不同的定数计算rt_ini
 * 5. 根据准确率区间计算最终rating
 * 6. 计算6个维度的rating值
 * 
 * @param songsDB 曲目数据库
 * @param input 计算输入参数
 * @returns 包含7个维度rating的计算结果，出错时返回null
 */
export function calculateTaikoRating(
  songsDB: SongData[],
  input: CalculationInput
): CalculationResult | null {
  // 步骤1：查找曲目数据
  const songData = findSongData(songsDB, input.id, input.difficulty);
  if (!songData) {
    console.error(`未找到曲目数据: id=${input.id}, difficulty=${input.difficulty}`);
    return null;
  }

  // 验证输入范围
  if (input.accuracy_per < 0 || input.accuracy_per > 1 || input.bad_per < 0 || input.bad_per > 1) {
    console.error('准确率和不可率必须在0-1范围内');
    return null;
  }

  // 将accuracy_per根据calculator文件中的calcY函数换算成accuracy值
  const accuracy = calcY(input.accuracy_per, 'comprehensive');

  // 计算各个参考rating值
  const rt_90 = calcSingleRating(songData.sub_constant_1, calcY(0.9, 'comprehensive'));
  const rt_95_ref = calcSingleRating(songData.sub_constant_1, calcY(0.95, 'comprehensive'));
  const rt_95 = calcSingleRating(songData.main_constant, calcY(0.95, 'comprehensive'));
  const rt_100_ref = calcSingleRating(songData.main_constant, calcY(1, 'comprehensive'));
  const rt_100 = calcSingleRating(songData.sub_constant_2, calcY(1, 'comprehensive'));

  // 计算rt_ini，根据accuracy_per选择不同的定数
  const x_ini = input.accuracy_per <= 0.95
    ? songData.sub_constant_1
    : songData.main_constant;
  const rt_ini = calcSingleRating(x_ini, accuracy);

  // 计算最终rating
  let rating: number;
  if (input.accuracy_per <= 0.9) {
    rating = rt_ini;
  } else if (input.accuracy_per <= 0.95) {
    // 线性插值：0.9-0.95区间
    rating = rt_90 + (rt_95 - rt_90) * (rt_ini - rt_90) / (rt_95_ref - rt_90);
  } else {
    // 线性插值：0.95-1.0区间
    rating = rt_95 + (rt_100 - rt_95) * (rt_ini - rt_95) / (rt_100_ref - rt_95);
  }

  // 计算各维度rating
  /**
  const stamina_rt = calcDimensionRating(rating, songData.stamina);
  const handspeed_rt = calcDimensionRating(rating, songData.handspeed);
  const accuracy_rt = calcDimensionRating(rating, accuracy);
  

  const stamina_rt = calcLnRating(rating, songData.stamina, accuracy);
  const handspeed_rt = calcLnRating(rating, songData.handspeed, accuracy);
  */
  // const accuracy_rt = calcLnRating(rating, accuracy, accuracy);
  const stamina_rt = calcSingleRating(accuracy, rating);

  const stamina_rt = calcSingleRating(songData.stamina, accuracy);
  const handspeed_rt = calcSingleRating(songData.handspeed, accuracy);
  
  // 计算爆发rating
  // const burst_rt_base = calcDimensionRating(rating, songData.burst);
  // const burst_rt_base = calcLnRating(rating, songData.burst, accuracy);
  const burst_rt_base = calcSingleRating(songData.burst, accuracy);
  // const burst_hs_factor = songData.handspeed > 0 ? MIN(rating / songData.handspeed, 1) : 1;
  // const burst_hs_factor = songData.handspeed > 0 ? MIN(rating / songData.handspeed / MIN(rt_100 / songData.handspeed , 1) , 1) : 1;
  const burst_hs_factor = songData.handspeed > 0 ? MIN(accuracy / songData.handspeed, 1) : 1;
  // const burst_rt = burst_rt_base * burst_hs_factor;
  const burst_rt = burst_rt_base * burst_hs_factor > handspeed_rt ? handspeed_rt + MIN(MAX(accuracy - songData.handspeed, 0) / (songData.burst - songData.handspeed), 1) * (burst_rt_base * burst_hs_factor - handspeed_rt) : burst_rt_base * burst_hs_factor;

  // 计算复合rating
  // const complex_rt_base = calcDimensionRating(rating, songData.complex);
  // const complex_rt_base = calcLnRating(rating, songData.complex, accuracy);
  const complex_rt_base = calcSingleRating(songData.complex, accuracy);
  const complex_penalty = (5000 / 9) * POWER(MAX(0.03 - input.bad_per, 0), 2) + 0.5;
  const complex_rt = complex_rt_base * complex_penalty;

  // 计算部分满分rating用于计算节奏rating
  // const burst_rt_100 = calcDimensionRating(rt_100, songData.burst);

  // 计算节奏rating
  // const rhythm_rt_base = calcDimensionRating(rating, songData.rhythm);
  // const rhythm_rt_base = calcLnRating(rating, songData.rhythm, accuracy);
  const rhythm_rt_base = calcSingleRating(songData.rhythm, accuracy);
  // const rhythm_burst_factor = songData.burst > 0 ? MIN(burst_rt / songData.burst, 1) : 1;
  // const rhythm_burst_factor = songData.burst > 0 ? MIN(burst_rt / songData.burst / MIN(burst_rt_100 / songData.burst , 1) , 1) : 1;
  const rhythm_burst_factor = 1;
  const rhythm_rt = rhythm_rt_base *
    burst_hs_factor *
    rhythm_burst_factor;

  // 返回7个计算结果 + 中间量
  return {
    rating,
    stamina_rt,
    handspeed_rt,
    burst_rt,
    complex_rt,
    rhythm_rt,
    accuracy_rt,
    intermediate: {
      burst_hs_factor,
      complex_penalty,
      rhythm_burst_factor,
    },
  };
}

/**
 * 批量计算多个曲目的rating
 * @param songsDB 曲目数据库
 * @param inputs 多个输入参数数组
 * @returns 计算结果数组
 */
export function calculateBatchTaikoRating(
  songsDB: SongData[],
  inputs: CalculationInput[]
): (CalculationResult | null)[] {
  return inputs.map(input => calculateTaikoRating(songsDB, input));
}

/**
 * 计算单个曲目的最佳可能rating（准确率100%，不可率0%）
 * 可用于评估曲目的理论最高分
 * @param songsDB 曲目数据库
 * @param id 曲目ID
 * @param difficulty 难度
 * @returns 最佳rating结果
 */
export function calculateBestPossibleRating(
  songsDB: SongData[],
  id: number,
  difficulty: number
): CalculationResult | null {
  const input: CalculationInput = {
    id,
    difficulty,
    accuracy_per: 1.0,  // 100%准确率
    bad_per: 0.0        // 0%不可率
  };

  return calculateTaikoRating(songsDB, input);
}

// 导出类型，便于在其他文件中使用
export type { SongData, CalculationInput, CalculationResult, CalculationIntermediate };

// 使用示例
/*
// 示例1：单曲目计算
const songsDB: SongData[] = [
  {
    id: 123,
    difficulty: 2,
    stamina: 12.5,
    handspeed: 11.8,
    burst: 13.2,
    complex: 10.7,
    rhythm: 9.5,
    main_constant: 13.5,
    sub_constant_1: 12.8,
    sub_constant_2: 14.2
  },
  // ... 更多曲目数据
];

const input: CalculationInput = {
  id: 123,
  difficulty: 2,
  accuracy_per: 0.98,  // 98%准确率
  bad_per: 0.01        // 1%不可率
};

const result = calculateTaikoRating(songsDB, input);
if (result) {
  console.log('综合rating:', result.rating);
  console.log('体力rating:', result.stamina_rt);
  console.log('手速rating:', result.handspeed_rt);
  console.log('爆发rating:', result.burst_rt);
  console.log('复合rating:', result.complex_rt);
  console.log('节奏rating:', result.rhythm_rt);
  console.log('精度rating:', result.accuracy_rt);
}

// 示例2：批量计算
const inputs: CalculationInput[] = [
  { id: 123, difficulty: 2, accuracy_per: 0.98, bad_per: 0.01 },
  { id: 124, difficulty: 3, accuracy_per: 0.96, bad_per: 0.02 },
  { id: 125, difficulty: 4, accuracy_per: 0.92, bad_per: 0.05 }
];

const batchResults = calculateBatchTaikoRating(songsDB, inputs);
batchResults.forEach((result, index) => {
  if (result) {
    console.log(`曲目${index+1}的rating:`, result.rating);
  }
});

// 示例3：计算理论最高分
const bestRating = calculateBestPossibleRating(songsDB, 123, 2);
if (bestRating) {
  console.log('理论最高rating:', bestRating.rating);
}
*/
