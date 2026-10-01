import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Eraser } from 'lucide-react'

export function SignaturePad({onChange,resetKey}:{onChange:(value:Blob|null)=>void;resetKey:number}){
 const canvasRef=useRef<HTMLCanvasElement>(null);const drawingRef=useRef(false);const inkRef=useRef(false);const [hasInk,setHasInk]=useState(false)
 const point=(event:ReactPointerEvent<HTMLCanvasElement>)=>{const canvas=canvasRef.current!;const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height}}
 const clear=()=>{const canvas=canvasRef.current;if(!canvas)return;canvas.getContext('2d')?.clearRect(0,0,canvas.width,canvas.height);inkRef.current=false;setHasInk(false);onChange(null)}
 useEffect(()=>{clear()},[resetKey])
 const start=(event:ReactPointerEvent<HTMLCanvasElement>)=>{const canvas=canvasRef.current;if(!canvas)return;drawingRef.current=true;canvas.setPointerCapture(event.pointerId);const ctx=canvas.getContext('2d');const p=point(event);if(ctx){ctx.beginPath();ctx.moveTo(p.x,p.y)}}
 const move=(event:ReactPointerEvent<HTMLCanvasElement>)=>{if(!drawingRef.current)return;const ctx=canvasRef.current?.getContext('2d');const p=point(event);if(ctx){ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#102348';ctx.lineTo(p.x,p.y);ctx.stroke();inkRef.current=true;setHasInk(true)}}
 const finish=()=>{if(!drawingRef.current)return;drawingRef.current=false;const canvas=canvasRef.current;if(!canvas)return;canvas.getContext('2d')?.closePath();if(!inkRef.current){onChange(null);return}canvas.toBlob(blob=>onChange(blob),'image/png')}
 return <div className="signature-field"><div className="signature-heading"><div><b>ลายเซ็นหัวหน้าแผนก *</b><small>ให้หัวหน้าแผนกลงลายเซ็นในกรอบด้านล่าง</small></div><button type="button" className="btn compact secondary" disabled={!hasInk} onClick={clear}><Eraser size={15}/>ล้างลายเซ็น</button></div><canvas ref={canvasRef} width={900} height={260} className="signature-canvas" aria-label="พื้นที่วาดลายเซ็นหัวหน้าแผนก" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}/><small className="signature-disclaimer">ลายเซ็นนี้แนบกับคำขอเบิกและไม่สามารถแก้ไขได้หลังส่งคำขอ</small></div>
}
