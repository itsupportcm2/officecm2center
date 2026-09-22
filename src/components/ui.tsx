import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Item, TransactionType } from '../types'

export const stockStatus=(item:Pick<Item,'quantity'|'minStock'>)=>item.quantity===0?'หมด':item.quantity<=item.minStock?'ใกล้หมด':'ปกติ'
export function StatusBadge({item}:{item:Pick<Item,'quantity'|'minStock'>}){const s=stockStatus(item);return <span className={`status status-${s==='ปกติ'?'normal':s==='ใกล้หมด'?'low':'out'}`}>{s}</span>}
export function TxBadge({type}:{type:TransactionType}){const labels={IN:'รับเข้า',OUT:'เบิกออก',ADJUST:'ปรับยอด',TRANSFER:'โอนย้าย'};return <span className={`tx tx-${type.toLowerCase()}`}>{labels[type]}</span>}
export function Empty({text='ไม่พบข้อมูล'}:{text?:string}){return <div className="empty"><div className="empty-mark">□</div><p>{text}</p></div>}
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){return <div className="modal-backdrop" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="ปิด"><X size={20}/></button></header>{children}</section></div>}
export function Confirm({title,detail,onCancel,onConfirm}:{title:string;detail:string;onCancel:()=>void;onConfirm:()=>void}){return <Modal title={title} onClose={onCancel}><div className="modal-body"><p className="muted">{detail}</p></div><div className="modal-actions"><button className="btn secondary" onClick={onCancel}>ยกเลิก</button><button className="btn primary" onClick={onConfirm}>ยืนยัน</button></div></Modal>}
export function Toast({message}:{message:string}){return <div className="toast" role="status">✓ {message}</div>}
