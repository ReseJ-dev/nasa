import type { RegionId } from '../../3d/src/contract/types'

const hrpRisks = 'https://www.nasa.gov/hrp/risks/'

export const ADVICE: Record<RegionId, readonly [string, string]> = {
  heart: ['Учитывайте аэробную нагрузку при наблюдении за сердечно-сосудистой адаптацией к микрогравитации.', hrpRisks],
  brain: ['Отслеживайте сон и нагрузку при длительной изоляции. Повышенный CO₂ связан с риском головной боли.', 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/ и https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/'],
  bones: ['Учитывайте упражнения с сопротивлением и наблюдение за плотностью нагружаемых костей при микрогравитации.', 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/'],
  muscles: ['Учитывайте упражнения с сопротивлением для поддержания мышц в микрогравитации.', hrpRisks],
  eyes: ['Отслеживайте изменения зрения. Сдвиг жидкостей к голове изучается как возможный механизм SANS.', 'https://humanresearchroadmap.nasa.gov/Gaps/gap.aspx?i=675'],
  immune: ['Отслеживайте дозу радиации как один из возможных факторов иммунного риска. Для оценки иммунитета нужны отдельные данные.', 'https://humanresearchroadmap.nasa.gov/gaps/gap.aspx?i=818'],
  lungs: ['Отслеживайте CO₂ в воздухе кабины и работу системы его удаления. Оценка отражает воздействие среды на дыхание.', 'https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/'],
}
