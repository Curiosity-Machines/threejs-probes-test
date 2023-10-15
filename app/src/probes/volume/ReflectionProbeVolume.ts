import { Box3, Vector3 } from 'three'
import { ReflectionProbe, RoughnessLodMapping } from '../Probe'
import { ReflectionVolumeData } from '../data'
import { ReflectionVolumeProps } from '../props'
import { ProbeInfluenceType, ProbeRatio } from '../type'
import { ProbeVolume } from './ProbeVolume'

export class ReflectionProbeVolume extends ProbeVolume<
  ReflectionVolumeData,
  'reflection',
  ReflectionProbe
> {
  readonly startRoughness: number
  readonly endRoughness: number
  readonly levelRoughness: number
  readonly intensity: number
  readonly nbLevels: number
  readonly falloff: number
  readonly influenceType: ProbeInfluenceType
  readonly influenceDistance: number

  static roughnessToTextureLod(
    roughness: number,
    rougnessLod: RoughnessLodMapping
  ): number {
    return (
      Math.min(
        Math.max(
          roughness / (rougnessLod.endRoughness - rougnessLod.startRoughness) -
            rougnessLod.startRoughness,
          0
        ),
        1
      ) * rougnessLod.nbLevels
    )
  }

  protected influenceBounds = new Box3()
  readonly reflectionProbe: ReflectionProbe

  constructor(props: ReflectionVolumeProps) {
    super(props)

    this.startRoughness = props.data.start_roughness
    this.endRoughness = props.data.end_roughness
    this.levelRoughness = props.data.level_roughness
    this.intensity = props.data.intensity
    this.nbLevels = props.data.nb_levels
    this.falloff = props.data.falloff
    this.influenceType = props.data.influence_type
    this.influenceDistance = props.data.influence_distance

    if (this.influenceType === 'BOX') {
      this.influenceBounds.min.set(
        this.scale.x +
          (1 - this.falloff) * this.influenceDistance * this.scale.x,
        this.scale.y +
          (1 - this.falloff) * this.influenceDistance * this.scale.y,
        this.scale.z +
          (1 - this.falloff) * this.influenceDistance * this.scale.z
      )

      this.influenceBounds.max.set(
        this.scale.x + this.influenceDistance * this.scale.x,
        this.scale.y + this.influenceDistance * this.scale.y,
        this.scale.z + this.influenceDistance * this.scale.z
      )
    }

    if (!this.textures[0]) {
      throw new Error('No texture for reflection probe')
    }

    this.reflectionProbe = {
      position: this.position.clone(),
      texture: this.textures[0],
      type: 'reflection',
      startRoughness: this.startRoughness,
      endRoughness: this.endRoughness,
      nbLevels: this.nbLevels,
    }

    this.probes.push(this.reflectionProbe)
  }

  protected computeBounds(): void {
    const scale = this.scale.clone().multiplyScalar(this.influenceDistance)

    this._bounds.min.set(
      this.position.x - scale.x,
      this.position.y - scale.y,
      this.position.z - scale.z
    )

    this._bounds.max.set(
      this.position.x + scale.x,
      this.position.y + scale.y,
      this.position.z + scale.z
    )
  }

  getSuroundingProbes(
    position: Vector3,
    volumeRatio: number,
    result: ProbeRatio[],
    offset = 0
  ): number {
    if (result[offset] === undefined) {
      result[offset] = [this.reflectionProbe, volumeRatio]
    } else {
      result[offset][0] = this.reflectionProbe
      result[offset][1] = volumeRatio
    }

    return 1
  }
  getGlobalRatio(position: Vector3): number {
    if (this.bounds.containsPoint(position) === false) {
      return 0
    }

    let relativeX =
      Math.abs(position.x - this.position.x) /
      this.scale.x /
      this.influenceDistance
    let relativeY =
      Math.abs(position.y - this.position.y) /
      this.scale.y /
      this.influenceDistance
    let relativeZ =
      Math.abs(position.z - this.position.z) /
      this.scale.z /
      this.influenceDistance

    if (this.influenceType === 'BOX') {
      const ratioX = Math.min(1, (1 - relativeX) / this.falloff)
      const ratioY = Math.min(1, (1 - relativeY) / this.falloff)
      const ratioZ = Math.min(1, (1 - relativeZ) / this.falloff)

      const ratio = Math.min(ratioX, ratioY, ratioZ)

      return ratio
    } else if (this.influenceType === 'ELIPSOID') {

      const scaledLength = Math.sqrt(
        relativeX * relativeX + relativeY * relativeY + relativeZ * relativeZ
      )

      const ratio = Math.min(1, Math.max(0, (1 - scaledLength) / this.falloff)) 

      // console.log('ratio', ratio)

      return ratio
    } else {
      throw new Error(`Unknown influence type ${this.influenceType}`)
    }
  }
}
