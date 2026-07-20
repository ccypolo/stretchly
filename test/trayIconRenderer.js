import 'chai/register-should'
import { rainDropPositions } from '../app/utils/trayIconRenderer.js'

describe('trayIconRenderer rain drops', () => {
  it('places rain drops near the cloud baseline, not at the icon top', () => {
    const size = 32
    const cx = size * 0.5
    const cy = size * 0.58
    const w = size * 0.5
    const drops = rainDropPositions(cx, cy, w, 3)

    drops.should.have.length(3)
    for (const drop of drops) {
      // Bug was: y ≈ 1px at top due to operator precedence.
      // Correct: y stays around cy (below the cloud).
      drop.y.should.be.above(size * 0.4)
      drop.y.should.be.closeTo(cy, w * 0.1)
    }
  })

  it('staggers alternate drops slightly below the baseline', () => {
    const drops = rainDropPositions(16, 20, 16, 3)
    drops[0].y.should.equal(20)
    drops[1].y.should.be.above(drops[0].y)
    drops[2].y.should.equal(20)
  })

  it('spreads drops horizontally across the cloud width', () => {
    const drops = rainDropPositions(16, 20, 16, 3)
    drops[0].x.should.be.below(drops[1].x)
    drops[1].x.should.be.below(drops[2].x)
  })
})
