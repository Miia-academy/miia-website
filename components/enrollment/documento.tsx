import { Checkbox, Input, InputOtp, Popover, PopoverContent, PopoverTrigger, cn } from '@heroui/react'
import { Button } from '@components/ui/button'
import { canBeForeign, documentFormat, partialPattern } from '@modules/enrollment/document-number'

const inputClasses = { label: 'after:text-secondary', inputWrapper: 'bg-surface' }

/** Spazio tra i gruppi di caselle (lettere | cifre | lettere). Classi scritte per intero per Tailwind. */
const GROUP_GAPS: Record<string, string> = {
  carta_identita_elettronica: '[&>*:nth-child(2)]:mr-2 [&>*:nth-child(7)]:mr-2',
  carta_identita: '[&>*:nth-child(2)]:mr-2',
  passaporto: '[&>*:nth-child(2)]:mr-2',
}

const HIGHLIGHT = '#CD212A'

/** Illustrazioni schematiche (non foto di documenti veri): in rosso il punto dove si legge il numero. */
function Illustration({ tipo }: { tipo: string }) {
  const line = (x: number, y: number, w: number) => <rect x={x} y={y} width={w} height="5" rx="2.5" fill="#C9CBCA" />
  if (tipo === 'carta_identita') {
    return (
      <svg viewBox="0 0 300 190" className="w-full" role="img" aria-label="Carta d'identità cartacea aperta, numero in alto a destra">
        <rect x="4" y="4" width="292" height="182" rx="8" fill="#F1EBDD" stroke="#B9AE95" strokeWidth="2" />
        <line x1="150" y1="4" x2="150" y2="186" stroke="#B9AE95" strokeWidth="2" strokeDasharray="4 4" />
        <rect x="20" y="40" width="54" height="68" rx="4" fill="#D9D2C1" />
        {line(84, 46, 50)}
        {line(84, 62, 40)}
        {line(84, 78, 52)}
        {line(20, 130, 110)}
        {line(20, 146, 90)}
        {line(166, 46, 110)}
        {line(166, 62, 90)}
        {line(166, 78, 100)}
        {line(166, 94, 80)}
        <rect x="200" y="140" width="84" height="26" rx="4" fill="none" stroke={HIGHLIGHT} strokeWidth="3" />
        <text x="242" y="158" textAnchor="middle" fontSize="13" fontFamily="monospace" fill={HIGHLIGHT}>
          AA 1234567
        </text>
      </svg>
    )
  }
  if (tipo === 'passaporto') {
    return (
      <svg viewBox="0 0 300 200" className="w-full" role="img" aria-label="Pagina con la foto del passaporto, numero in alto a destra">
        <rect x="4" y="4" width="292" height="192" rx="8" fill="#EEF1F4" stroke="#AEB6BF" strokeWidth="2" />
        <rect x="18" y="44" width="62" height="80" rx="4" fill="#D3D9DF" />
        {line(92, 50, 70)}
        {line(92, 66, 90)}
        {line(92, 82, 60)}
        {line(92, 98, 80)}
        {line(92, 114, 50)}
        <rect x="194" y="12" width="94" height="28" rx="4" fill="none" stroke={HIGHLIGHT} strokeWidth="3" />
        <text x="241" y="31" textAnchor="middle" fontSize="13" fontFamily="monospace" fill={HIGHLIGHT}>
          YA1234567
        </text>
        <rect x="14" y="146" width="272" height="40" rx="4" fill="#E2E7EC" />
        <text x="20" y="162" fontSize="9" fontFamily="monospace" fill="#7A8591">
          P&lt;ITAROSSI&lt;&lt;MARIO&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
        </text>
        <text x="20" y="178" fontSize="9" fontFamily="monospace" fill="#7A8591">
          <tspan fill={HIGHLIGHT} fontWeight="bold">
            YA1234567
          </tspan>
          &lt;0ITA8512101M3001019&lt;&lt;&lt;&lt;
        </text>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 300 190" className="w-full" role="img" aria-label="Fronte della carta d'identità elettronica, numero in alto a destra">
      <rect x="4" y="4" width="292" height="182" rx="12" fill="#EAF2EC" stroke="#A9C2AF" strokeWidth="2" />
      <rect x="18" y="48" width="68" height="88" rx="4" fill="#CFDDD2" />
      {line(98, 56, 80)}
      {line(98, 72, 100)}
      {line(98, 88, 70)}
      {line(98, 104, 90)}
      {line(98, 120, 60)}
      <rect x="196" y="12" width="92" height="28" rx="4" fill="none" stroke={HIGHLIGHT} strokeWidth="3" />
      <text x="242" y="31" textAnchor="middle" fontSize="13" fontFamily="monospace" fill={HIGHLIGHT}>
        CA12345AB
      </text>
      {line(18, 156, 140)}
    </svg>
  )
}

const WHERE_TEXT: Record<string, string> = {
  carta_identita_elettronica: 'Sul fronte della carta, in alto a destra, stampato in rosso.',
  carta_identita: 'All’interno del libretto, nella pagina con i dati: 2 lettere e 7 cifre.',
  passaporto: 'Nella pagina con la foto, in alto a destra (“Passaporto N.”). È anche all’inizio della seconda riga in basso.',
}

function WhereToFind({ tipo, estero }: { tipo: string; estero: boolean }) {
  return (
    <Popover placement="bottom-start">
      <PopoverTrigger>
        <Button size="sm" variant="light" className="self-start px-0 min-w-0 h-auto text-primary underline">
          Dove lo trovo?
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-w-xs p-4">
        <div className="flex flex-col gap-3 text-sm">
          {estero ? (
            <p>
              Scrivi il <strong>numero del documento</strong> (in inglese “document number”), non il numero personale o il
              codice fiscale. Di solito è in alto a destra.
            </p>
          ) : (
            <>
              <Illustration tipo={tipo} />
              <p>{WHERE_TEXT[tipo]}</p>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface DocumentNumberProps {
  tipo: string
  numero: string
  estero: boolean
  paese: string
  errors: Record<string, string>
  onNumero: (value: string) => void
  onEstero: (value: boolean) => void
  onPaese: (value: string) => void
}

/** Numero del documento: caselle a formato fisso per i documenti italiani, campo libero per quelli esteri. */
export function DocumentNumber({ tipo, numero, estero, paese, errors, onNumero, onEstero, onPaese }: DocumentNumberProps) {
  if (!tipo) return null
  const foreign = estero && canBeForeign(tipo)
  const format = documentFormat(tipo, foreign)

  return (
    <div className="flex flex-col gap-3">
      {canBeForeign(tipo) && (
        <Checkbox isSelected={estero} onValueChange={onEstero} size="sm" classNames={{ label: 'text-sm' }}>
          {tipo === 'passaporto' ? 'Passaporto rilasciato da un altro paese' : 'Carta rilasciata da un altro paese dell’Unione europea'}
        </Checkbox>
      )}

      {format ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Numero del documento<span className="text-secondary"> *</span>
          </span>
          <InputOtp
            name="documento_numero"
            length={format.lunghezza}
            value={numero}
            onValueChange={(v) => onNumero(v.toUpperCase())}
            allowedKeys={partialPattern(format)}
            inputMode="text"
            autoComplete="off"
            aria-label="Numero del documento"
            size="sm"
            isInvalid={!!errors.documento_numero}
            errorMessage={errors.documento_numero}
            description={`${format.descrizione}, per esempio ${format.esempio}`}
            classNames={{
              segmentWrapper: cn('gap-1 py-1', GROUP_GAPS[tipo]),
              segment: 'min-w-0 w-[26px] h-10 sm:w-9 sm:h-11 bg-surface hover:bg-surface-hover uppercase',
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Input
            name="documento_paese"
            label="Paese che lo ha rilasciato"
            isRequired
            value={paese}
            onValueChange={onPaese}
            isInvalid={!!errors.documento_paese}
            errorMessage={errors.documento_paese}
            classNames={inputClasses}
          />
          <Input
            name="documento_numero"
            label="Numero del documento"
            isRequired
            value={numero}
            onValueChange={(v) => onNumero(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={12}
            description="Solo lettere e cifre, come sul documento"
            isInvalid={!!errors.documento_numero}
            errorMessage={errors.documento_numero}
            classNames={inputClasses}
          />
        </div>
      )}
      <WhereToFind tipo={tipo} estero={foreign} />
    </div>
  )
}
