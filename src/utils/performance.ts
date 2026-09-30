export const beginTiming=()=>typeof performance==='undefined'?0:performance.now()

export const reportTiming=(label:string,startedAt:number)=>{
 if(!startedAt||typeof performance==='undefined')return
 const duration=Math.round(performance.now()-startedAt)
 if(duration>=250)console.info(`[CM Performance] ${label}: ${duration} ms`)
}
