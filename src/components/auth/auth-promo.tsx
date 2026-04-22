// /login · /signup 좌측 공유 promo — login.html 디자인 기준.
// sticky 고정, 통계는 하드코딩 (TODO: aggregateBotVisits 등으로 실측 주입)
import Link from 'next/link'

export function AuthPromo() {
  return (
    <section className="promo">
      <Link className="logo-top" href="/">
        <span className="mark" /> AI Place
      </Link>

      <div className="pitch">
        <h2>
          AI가 <span className="it">내 가게</span>를<br />
          제대로 말하도록.
        </h2>
        <p className="lede">
          파일럿 참여 중인 천안 업체는 지난 30일 동안 ChatGPT·Claude·Gemini에 172회 인용되었습니다.
        </p>

        <div className="stats">
          <div>
            <div className="n">172</div>
            <div className="s">월간 AI 인용</div>
          </div>
          <div>
            <div className="n">38%</div>
            <div className="s">전월 대비 증가</div>
          </div>
          <div>
            <div className="n">
              4.6<span className="star">★</span>
            </div>
            <div className="s">평균 업체 평점</div>
          </div>
        </div>
      </div>

      <div className="promo-foot">© 2026 AI Place · 기획·제작 디두(dedo) · support@dedo.kr</div>
    </section>
  )
}
