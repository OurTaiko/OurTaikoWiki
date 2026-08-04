import { Award, ExternalLink, Github, Heart, Users } from 'lucide-react'

const THANKS_PROJECTS = [
  {
    href: 'https://github.com/sigaer/taiko-bot',
    name: 'sigaer/taiko-bot',
    desc: '太鼓达人相关机器人项目',
  },
  {
    href: 'https://github.com/jack9966qk/TJARenderer',
    name: 'jack9966qk/TJARenderer',
    desc: 'TJA 谱面渲染引擎',
  },
  {
    href: 'https://github.com/OurTaiko/Constants',
    name: 'OurTaiko/Constants',
    desc: 'OurTaiko 定数与常量数据',
  },
]

const BILIBILI_CONTRIBUTORS = [
  { href: 'https://space.bilibili.com/884125', name: 'Tensei_Wu' },
  { href: 'https://space.bilibili.com/1277300', name: 'ice_mika' },
  { href: 'https://space.bilibili.com/47363886', name: 'DeathBruce' },
  { href: 'https://space.bilibili.com/25078362', name: '菌菌_Official' },
]

export function AboutPage() {
  return (
    <main className="page-shell about-page">
      <section className="about-hero">
        <span className="eyebrow">ABOUT</span>
        <div className="about-hero__title">
          <h1>关于本站</h1>
          <a
            className="about-repo-link"
            href="https://github.com/ourtaiko/ourtaikowiki"
            target="_blank"
            rel="noreferrer"
            aria-label="ourtaiko/ourtaikowiki"
          >
            <Github size={16} />
            <span>ourtaiko/ourtaikowiki</span>
          </a>
        </div>
        <p>OUR TAIKO WIKI 的曲目资料、Rating 计算与相关工具，离不开每一位贡献者的支持。</p>
      </section>

      <section className="about-section panel">
        <header className="about-section__header">
          <Users size={20} />
          <div>
            <h2>GitHub 贡献者</h2>
            <p>感谢所有为本项目提交代码与维护的开发者</p>
          </div>
        </header>
        <a
          className="about-contributors"
          href="https://github.com/ourtaiko/ourtaikowiki/graphs/contributors"
          target="_blank"
          rel="noreferrer"
        >
          <img
            src="https://contrib.rocks/image?repo=ourtaiko/ourtaikowiki"
            alt="OUR TAIKO WIKI GitHub 贡献者"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </a>
      </section>

      <section className="about-section panel">
        <header className="about-section__header">
          <Heart size={20} />
          <div>
            <h2>项目感谢</h2>
            <p>本项目参考或使用了以下开源项目</p>
          </div>
        </header>
        <div className="about-thanks">
          {THANKS_PROJECTS.map((project) => (
            <a key={project.href} className="about-thank-card" href={project.href} target="_blank" rel="noreferrer">
              <strong>{project.name}</strong>
              <span>{project.desc}</span>
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </section>

      <section className="about-section panel">
        <header className="about-section__header">
          <Award size={20} />
          <div>
            <h2>其他贡献者</h2>
            <p>在曲目资料、测试与反馈等方面提供帮助的朋友们</p>
          </div>
        </header>
        <div className="about-people">
          {BILIBILI_CONTRIBUTORS.map((person) => (
            <a key={person.href} className="about-person" href={person.href} target="_blank" rel="noreferrer">
              <strong>{person.name}</strong>
              <span>Bilibili 空间</span>
              <ExternalLink size={14} />
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}
