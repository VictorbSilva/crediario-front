#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, join } from 'node:path'

const MINIMA = 21
const FIREBASE = join('node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js')

function versaoMaiorDe(executavel) {
  const r = spawnSync(executavel, ['-version'], { encoding: 'utf8' })
  if (r.error || r.status !== 0) return null
  const bruto = `${r.stderr ?? ''}${r.stdout ?? ''}`
  const entre = /"([^"]+)"/.exec(bruto)
  if (!entre) return null
  const partes = entre[1].split('.')
  return Number(partes[0] === '1' ? partes[1] : partes[0]) || null
}

function binDoJavaHome() {
  const home = process.env.JAVA_HOME
  if (!home) return null
  const bin = join(home, 'bin')
  return existsSync(bin) ? bin : null
}

const env = { ...process.env }
const bin = binDoJavaHome()

if (bin && versaoMaiorDe(join(bin, 'java')) >= MINIMA) {
  env.PATH = bin + delimiter + env.PATH
} else {
  const noCaminho = versaoMaiorDe('java')
  if (!(noCaminho >= MINIMA)) {
    console.error(
      `\nO emulador do Firestore roda em Java e o firebase-tools recusa versão anterior à ${MINIMA}.\n` +
        `  java no PATH:  ${noCaminho ?? 'não encontrado'}\n` +
        `  JAVA_HOME:     ${process.env.JAVA_HOME ?? 'não definido'}\n\n` +
        `Aponte o JAVA_HOME para um JDK ${MINIMA}+ e rode de novo — este script coloca o\n` +
        `bin dele na frente do PATH sozinho, sem depender da ordem do PATH da máquina.\n`,
    )
    process.exit(1)
  }
}

const filho = spawn(process.execPath, [FIREBASE, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
})
filho.on('exit', (codigo, sinal) => process.exit(sinal ? 1 : (codigo ?? 1)))
