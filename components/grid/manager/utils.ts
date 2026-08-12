export const OCCUPAZIONE_OPTIONS = [
  { key: 'Studente', label: 'Studente' },
  { key: 'Disoccupato', label: 'Disoccupato' },
  { key: 'Operativo', label: 'Operativo' },
  { key: 'Tecnico', label: 'Tecnico' },
  { key: 'Impiegato', label: 'Impiegato' },
  { key: 'Freelance', label: 'Freelance' },
  { key: 'Quadro', label: 'Quadro' },
  { key: 'Dirigente', label: 'Dirigente' },
  { key: 'Imprenditore', label: 'Imprenditore' },
  { key: 'Altro', label: 'Altro' },
]

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}