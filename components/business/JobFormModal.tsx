import React, { useState, useEffect } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Select,
  SelectItem,
  Button,
  Divider,
} from '@heroui/react'
import { useDataContext } from '@modules/context'
import {
  PROVINCE_TRIVENETO,
  LINGUE_STRANIERE,
  TIPO_CONTRATTO_LABELS,
  ORARIO_LAVORO_LABELS,
  GRADO_ESPERIENZA_LABELS,
  TRASFERTE_LABELS,
  type Job,
  type TipoContratto,
  type OrarioLavoro,
  type GradoEsperienza,
  type TrasferteOption,
} from '@modules/jobs/types'

interface JobFormModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  jobData?: Job | null
  onSuccess: () => void
  showAlert: (title: string, message: string, isError?: boolean) => void
}

function parseStoryblokSkill(item: any) {
  if (!item) return { key: '', title: '', description: '' }
  if (typeof item === 'string') return { key: item, title: item, description: '' }

  const title = String(item.name || item.nome || item.title || '')
  const description = String(item.value || item.descrizione || item.description || '')
  return { key: title, title, description }
}

const INITIAL_FORM_STATE = {
  title: '',
  description: '',
  provincie: new Set<string>([]),
  tipo_contratto: 'indeterminato' as TipoContratto,
  ral: '',
  orari_lavoro: 'full_time' as OrarioLavoro,
  trasferte: 'no' as TrasferteOption,
  grado_esperienza: 'prima_esperienza' as GradoEsperienza,
  competenze: new Set<string>([]),
  lingue: new Set<string>([]),
}

export function JobFormModal({
  isOpen,
  onOpenChange,
  onClose,
  jobData,
  onSuccess,
  showAlert,
}: JobFormModalProps) {
  const { competenze } = useDataContext()
  const [loading, setLoading] = useState(false)
  const isEdit = Boolean(jobData)

  const [form, setForm] = useState(INITIAL_FORM_STATE)

  // Sincronizza lo stato all'apertura del modale (Creazione vs Modifica)
  useEffect(() => {
    if (isOpen) {
      if (jobData) {
        setForm({
          title: jobData.title || '',
          description: jobData.description || '',
          provincie: new Set<string>(jobData.provincie || []),
          tipo_contratto: jobData.tipo_contratto || 'indeterminato',
          ral: jobData.ral || '',
          orari_lavoro: jobData.orari_lavoro || 'full_time',
          trasferte: jobData.trasferte || 'no',
          grado_esperienza: jobData.grado_esperienza || 'prima_esperienza',
          competenze: new Set<string>(jobData.competenze || []),
          lingue: new Set<string>(jobData.lingue || []),
        })
      } else {
        setForm(INITIAL_FORM_STATE)
      }
    }
  }, [isOpen, jobData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title.trim() || !form.description.trim()) {
      showAlert('Campo obbligatorio', 'Compila sia il titolo che la descrizione.', true)
      return
    }

    if (form.provincie.size === 0) {
      showAlert('Sede Mancante', 'Seleziona almeno una provincia del Triveneto.', true)
      return
    }

    setLoading(true)

    const endpoint = isEdit ? `/api/job/${jobData!.id}` : '/api/job/create'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const payload = {
        title: form.title,
        description: form.description,
        provincie: Array.from(form.provincie),
        tipo_contratto: form.tipo_contratto,
        ral: form.ral,
        orari_lavoro: form.orari_lavoro,
        trasferte: form.trasferte,
        grado_esperienza: form.grado_esperienza,
        competenze: Array.from(form.competenze),
        lingue: Array.from(form.lingue),
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        showAlert('Successo', isEdit ? 'Inserzione modificata con successo!' : 'Inserzione pubblicata correttamente!')
        onClose()
        onSuccess()
      } else {
        showAlert('Errore', data.message || 'Operazione fallita.', true)
      }
    } catch {
      showAlert('Errore Connessione', 'Impossibile inviare i dati. Riprova più tardi.', true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
      backdrop="blur"
      classNames={{
        base: 'max-h-[90vh] my-auto mx-2 sm:mx-auto',
        header: 'border-b border-neutral-100 px-6 py-4',
        body: 'py-6 px-4 sm:px-6 overflow-y-auto',
        footer: 'border-t border-neutral-100 px-6 py-4',
      }}
    >
      <ModalContent>
        {(handleModalClose) => (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
            <ModalHeader className="text-lg sm:text-xl font-bold">
              {isEdit ? 'Modifica Inserzione' : 'Nuova Inserzione di Lavoro'}
            </ModalHeader>

            <ModalBody className="space-y-6">
              {/* SEZIONE 1: Informazioni & Requisiti */}
              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">
                  Informazioni & Requisiti
                </span>

                <Input
                  label="Titolo della Posizione"
                  placeholder="Es. Junior Interior Designer"
                  isRequired
                  value={form.title}
                  onValueChange={(v) => setForm({ ...form, title: v })}
                  variant="flat"
                />

                <Textarea
                  label="Descrizione dell'Offerta"
                  placeholder="Descrivi le responsabilità, il contesto aziendale e gli obiettivi..."
                  isRequired
                  minRows={3}
                  value={form.description}
                  onValueChange={(v) => setForm({ ...form, description: v })}
                  variant="flat"
                />

                <Select
                  label="Competenze Richieste"
                  selectionMode="multiple"
                  placeholder="Seleziona competenze"
                  variant="flat"
                  selectedKeys={form.competenze}
                  onSelectionChange={(keys) => setForm({ ...form, competenze: keys as Set<string> })}
                  classNames={{ popoverContent: 'max-w-[500px]' }}
                >
                  {(competenze || []).map((rawItem: any) => {
                    const { key, title, description } = parseStoryblokSkill(rawItem)
                    return (
                      <SelectItem key={key} textValue={title}>
                        <div className="flex flex-col gap-0.5 py-1.5 whitespace-normal">
                          <span className="text-sm font-semibold text-neutral-900 leading-tight">
                            {title}
                          </span>
                          {description && (
                            <span className="text-xs text-neutral-500 font-normal leading-relaxed block">
                              {description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    )
                  })}
                </Select>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Grado di Esperienza"
                    selectedKeys={[form.grado_esperienza]}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as GradoEsperienza
                      if (selected) setForm({ ...form, grado_esperienza: selected })
                    }}
                    variant="flat"
                  >
                    {Object.entries(GRADO_ESPERIENZA_LABELS).map(([key, label]) => (
                      <SelectItem key={key} textValue={String(label)}>
                        {String(label)}
                      </SelectItem>
                    ))}
                  </Select>

                  <Select
                    label="Lingue Straniere Richieste"
                    selectionMode="multiple"
                    placeholder="Seleziona lingue"
                    variant="flat"
                    selectedKeys={form.lingue}
                    onSelectionChange={(keys) => setForm({ ...form, lingue: keys as Set<string> })}
                  >
                    {LINGUE_STRANIERE.map((lang) => (
                      <SelectItem key={lang.key} textValue={lang.label}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>

              <Divider className="my-1" />

              {/* SEZIONE 2: Dettagli Operativi & Sede */}
              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">
                  Dettagli Operativi & Sede
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Sede Operativa (Triveneto)"
                    placeholder="Seleziona province"
                    selectionMode="multiple"
                    isRequired
                    selectedKeys={form.provincie}
                    onSelectionChange={(keys) => setForm({ ...form, provincie: keys as Set<string> })}
                    variant="flat"
                  >
                    {PROVINCE_TRIVENETO.map((prov) => (
                      <SelectItem key={prov.key} textValue={prov.label}>
                        {prov.label}
                      </SelectItem>
                    ))}
                  </Select>

                  <Select
                    label="Tipo di Contratto"
                    selectedKeys={[form.tipo_contratto]}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as TipoContratto
                      if (selected) setForm({ ...form, tipo_contratto: selected })
                    }}
                    variant="flat"
                  >
                    {Object.entries(TIPO_CONTRATTO_LABELS).map(([key, label]) => (
                      <SelectItem key={key} textValue={String(label)}>
                        {String(label)}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Orario di Lavoro"
                    selectedKeys={[form.orari_lavoro]}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as OrarioLavoro
                      if (selected) setForm({ ...form, orari_lavoro: selected })
                    }}
                    variant="flat"
                  >
                    {Object.entries(ORARIO_LAVORO_LABELS).map(([key, label]) => (
                      <SelectItem key={key} textValue={String(label)}>
                        {String(label)}
                      </SelectItem>
                    ))}
                  </Select>

                  <Select
                    label="Trasferte"
                    selectedKeys={[form.trasferte]}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as TrasferteOption
                      if (selected) setForm({ ...form, trasferte: selected })
                    }}
                    variant="flat"
                  >
                    {Object.entries(TRASFERTE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} textValue={String(label)}>
                        {String(label)}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                <Input
                  label="RAL / Retribuzione (opzionale)"
                  placeholder="Es. 24.000 € - 28.000 €"
                  value={form.ral}
                  onValueChange={(v) => setForm({ ...form, ral: v })}
                  variant="flat"
                />
              </div>
            </ModalBody>

            <ModalFooter>
              <Button variant="flat" onPress={handleModalClose} className="w-full sm:w-auto">
                Annulla
              </Button>
              <Button
                type="submit"
                isLoading={loading}
                className={`w-full sm:w-auto font-bold px-6 shadow-sm text-white ${isEdit ? 'bg-black' : 'bg-[#009245]'
                  }`}
              >
                {isEdit ? 'Salva Modifiche' : 'Pubblica Inserzione'}
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}