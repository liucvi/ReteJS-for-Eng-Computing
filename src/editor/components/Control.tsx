import { useRef, useState, useEffect } from 'react'
import { ClassicPreset } from 'rete'
import { triggerExecute } from '../engineEvents'
import {
  NumberControl,
  SliderControl,
  ToggleControl,
  ColourControl,
  ValueListControl,
  DomainSliderControl,
  ButtonControl,
} from '../controls'

export function CustomControl({ data }: { data: ClassicPreset.Control }) {
  const ref = useRef<HTMLInputElement>(null)

  if (data instanceof SliderControl) {
    const [value, setValue] = useState(data.value)
    useEffect(() => { setValue(data.value) }, [data.value])
    const commit = (next: number) => {
      data.setValue(next)
      setValue(data.value)
      triggerExecute()
    }
    return (
      <div className="gh-slider-control">
        <input
          type="range"
          min={data.min}
          max={data.max}
          step={data.step}
          value={value}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => commit(+e.target.value)}
        />
        <input
          ref={ref}
          type="number"
          value={value}
          step={data.step}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => commit(+e.target.value)}
        />
      </div>
    )
  }

  if (data instanceof NumberControl) {
    const [value, setValue] = useState(data.value)
    useEffect(() => { setValue(data.value) }, [data.value])
    return (
      <input
        ref={ref}
        type="number"
        value={value}
        step={data.step}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          data.setValue(+e.target.value)
          setValue(data.value)
          triggerExecute()
        }}
        className="gh-control-input"
      />
    )
  }

  // Toggle control
  if (data instanceof ToggleControl) {
    const [value, setValue] = useState(data.value)
    useEffect(() => { setValue(data.value) }, [data.value])
    return (
      <button
        className={`gh-toggle ${value ? 'on' : 'off'}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          const v = !value
          setValue(v)
          data.setValue(v)
          triggerExecute()
        }}
      >
        {value ? 'ON' : 'OFF'}
      </button>
    )
  }

  // Colour control
  if (data instanceof ColourControl) {
    const [value, setValue] = useState(data.value)
    useEffect(() => { setValue(data.value) }, [data.value])
    return (
      <div className="gh-colour-control">
        <input
          ref={ref}
          type="color"
          value={value}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            setValue(e.target.value)
            data.setValue(e.target.value)
            triggerExecute()
          }}
        />
        <span>{value}</span>
      </div>
    )
  }

  // Value list control
  if (data instanceof ValueListControl) {
    const [value, setValue] = useState(data.value)
    useEffect(() => { setValue(data.value) }, [data.value])
    return (
      <select
        className="gh-select"
        value={value}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          setValue(e.target.value)
          data.setValue(e.target.value)
          triggerExecute()
        }}
      >
        {data.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }

  // Domain slider control
  if (data instanceof DomainSliderControl) {
    const [min, setMin] = useState(data.min)
    const [max, setMax] = useState(data.max)
    useEffect(() => { setMin(data.min); setMax(data.max) }, [data.min, data.max])
    return (
      <div className="gh-domain-control">
        <div className="gh-domain-row">
          <span>Min</span>
          <input
            type="range"
            min={data.absMin}
            max={data.absMax}
            value={min}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = +e.target.value
              setMin(v)
              data.setMin(v)
              triggerExecute()
            }}
          />
          <span>{min.toFixed(1)}</span>
        </div>
        <div className="gh-domain-row">
          <span>Max</span>
          <input
            type="range"
            min={data.absMin}
            max={data.absMax}
            value={max}
            onPointerDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = +e.target.value
              setMax(v)
              data.setMax(v)
              triggerExecute()
            }}
          />
          <span>{max.toFixed(1)}</span>
        </div>
      </div>
    )
  }

  // Button control
  if (data instanceof ButtonControl) {
    return (
      <button
        className="gh-btn-control"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          data.click()
          triggerExecute()
        }}
      >
        {data.label}
      </button>
    )
  }

  // Default InputControl
  if (data instanceof ClassicPreset.InputControl) {
    const [value, setValue] = useState(data.value)
    useEffect(() => { setValue(data.value) }, [data.value])

    return (
      <input
        ref={ref}
        type={data.type}
        value={value ?? ''}
        readOnly={data.readonly}
        onPointerDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const val = data.type === 'number' ? +e.target.value : e.target.value
          setValue(val as never)
          data.setValue(val as never)
          triggerExecute()
        }}
        className="gh-control-input"
      />
    )
  }

  return null
}
