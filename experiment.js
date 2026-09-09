const EXP_VERSION='rsvp_hnsc_online_calibrated_v2';
const ITEM_MS=90,CUE_MS=500,FIX_MS=300,BLANK_MS=500,RESP_MS=3000;
const GLOBAL_DEG_H=4.7,GLOBAL_DEG_W=4.4;
const T1_PROMPT='请判断复合图形：<br>S = f 或 C = j';
const T2_PROMPT='请判断复合图形：<br>H = f 或 N = j';
const distractors=['A','E','F','K','L','T','U','V','Y','Z'];
const keyMap={
    HH:{global:'f',local:'f'},
    HN:{global:'f',local:'j'},
    NH:{global:'j',local:'f'},
    NN:{global:'j',local:'j'},
    SS:{global:'f',local:'f'},
    CC:{global:'j',local:'j'}
};
const info={}, results={section1:[],section2:[],section3:[],practice:[]};
const session={
    device:{},calibration:null,frame:{},keyboard_check:null,
    quality:{blur_count:0,total_blur_duration_ms:0,fullscreen_exit_count:0}
};
let blurStart=null;
let experimentAborted=false;

function terminateExperiment(reason='被试按 Q 主动终止'){
    if(experimentAborted)return;
    experimentAborted=true;
    session.abort_reason=reason;
    session.end_time_iso=new Date().toISOString();
    jsPsych.endExperiment(abortScreenHTML());
}

function now(){ return performance.now(); }
function deviceMeta(){
    return {
        version:EXP_VERSION,
        screen_css_width:screen.width,
        screen_css_height:screen.height,
        viewport_width:innerWidth,
        viewport_height:innerHeight,
        device_pixel_ratio:window.devicePixelRatio||1,
        user_agent:navigator.userAgent,
        platform:navigator.platform||'',
        language:navigator.language||'',
        timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||''
    };
}
function installQualityLogging(){
    const beginBlur=()=>{if(blurStart===null)blurStart=now();};
    const endBlur=()=>{
        if(blurStart!==null){
            session.quality.total_blur_duration_ms+=Math.round(now()-blurStart);
            session.quality.blur_count+=1;
            blurStart=null;
        }
    };
    window.addEventListener('blur',beginBlur);
    window.addEventListener('focus',endBlur);
    document.addEventListener('visibilitychange',()=>document.hidden?beginBlur():endBlur());
    document.addEventListener('fullscreenchange',()=>{
        if(!document.fullscreenElement&&!document.webkitFullscreenElement)
            session.quality.fullscreen_exit_count+=1;
    });
}
function calcCalibration(widthCm,heightCm,distanceCm){
    const widthMm=widthCm*10,heightMm=heightCm*10,distanceMm=distanceCm*10;
    const pxPerMmX=screen.width/widthMm,pxPerMmY=screen.height/heightMm;
    const degToRad=d=>d*Math.PI/180;
    const stimulusWidthMm=2*distanceMm*Math.tan(degToRad(GLOBAL_DEG_W)/2);
    const stimulusHeightMm=2*distanceMm*Math.tan(degToRad(GLOBAL_DEG_H)/2);
    const browserAspect=screen.width/screen.height,inputAspect=widthMm/heightMm;
    const aspectError=Math.abs(inputAspect-browserAspect)/browserAspect;
    return {
        screen_physical_width_cm:widthCm,screen_physical_height_cm:heightCm,viewing_distance_cm:distanceCm,
        screen_physical_width_mm:widthMm,screen_physical_height_mm:heightMm,viewing_distance_mm:distanceMm,
        px_per_mm_x:pxPerMmX,px_per_mm_y:pxPerMmY,
        target_global_height_deg:GLOBAL_DEG_H,target_global_width_deg:GLOBAL_DEG_W,
        stimulus_width_mm:stimulusWidthMm,stimulus_height_mm:stimulusHeightMm,
        stimulus_width_px:stimulusWidthMm*pxPerMmX,stimulus_height_px:stimulusHeightMm*pxPerMmY,
        screen_aspect_error_ratio:aspectError,
        calibration_status:aspectError<=0.18?'ok':'warning_aspect'
    };
}
function reasonableCalibration(w,h,d){
    return Number.isFinite(w)&&Number.isFinite(h)&&Number.isFinite(d)&&w>=10&&w<=150&&h>=6&&h<=100&&d>=30&&d<=150;
}
function stimulusStyle(){
    const c=session.calibration||{stimulus_width_px:Math.min(innerWidth*.45,520),stimulus_height_px:Math.min(innerWidth*.45,520)};
    return `--stim-w:${Math.round(c.stimulus_width_px)}px;--stim-h:${Math.round(c.stimulus_height_px)}px;`;
}
const img=n=>`<img class="stim-img" src="stimuli/${n}.png" alt="${n}">`;
const rnd=a=>a[Math.floor(Math.random()*a.length)];
const PRELOAD_IMAGES=[
    'section1',
    'section2',
    'section3',
    'SS',
    'CC',
    'HH',
    'HN',
    'NH',
    'NN',
    ...distractors
].map(name=>`stimuli/${name}.png`);
const decodedImageCache=new Map();

async function decodeStimulusImages(){
    const failures=[];
    await Promise.all(PRELOAD_IMAGES.map(async path=>{
        const image=new Image();
        image.decoding='async';
        image.src=path;
        try{
            await image.decode();
            decodedImageCache.set(path,image);
        }catch(error){
            console.error(`图片解码失败：${path}`,error);
            failures.push(path);
        }
    }));
    if(failures.length) throw new Error(`有 ${failures.length} 张图片解码失败`);
}

function setStimulusImage(element,stimulusName){
    const path=`stimuli/${stimulusName}.png`;
    const cachedImage=decodedImageCache.get(path);
    if(!cachedImage) throw new Error(`图片不在解码缓存中：${path}`);
    element.src=cachedImage.src;
}

const Preloadpicture = {
        type:jsPsychPreload,
        images:PRELOAD_IMAGES,
        show_progress_bar:true,
        message:'正在加载实验图片，请稍候……',
        show_progress_bar: true,
        continue_after_error:false,
        error_message: `
            <p style="font-size:22px; color:#c62828;">
                部分实验材料加载失败，请检查网络并刷新页面重试。
            </p>
        `,
         on_finish: function (data) {
             console.log('预加载结果：', data);
         }
 };

const DecodePictures={
    type:jsPsychHtmlKeyboardResponse,
    stimulus:'<h2>正在准备实验材料</h2><p>正在解码图片，请稍候……</p>',
    choices:'NO_KEYS',
    on_load:async()=>{
        try{
            await decodeStimulusImages();
            jsPsych.finishTrial({
                decoded_image_count:decodedImageCache.size,
                image_decode_success:1
            });
        }catch(error){
            console.error(error);
            terminateExperiment('实验材料解码失败');
        }
    }
};

function playImageSequence(container,sequence){
    return new Promise(resolve=>{
        container.innerHTML='';
        const stimulusImage=document.createElement('img');
        stimulusImage.className='stim-img';
        stimulusImage.setAttribute('style',stimulusStyle());
        // RSVP 刺激不能显示替代文本；alt 文本会在图片 src 尚未设置或
        // 图片尚未完成解码时被浏览器绘制出来，造成短暂的文字闪现。
        stimulusImage.alt='';
        stimulusImage.setAttribute('aria-hidden','true');
        setStimulusImage(stimulusImage,sequence[0]);
        container.appendChild(stimulusImage);
        let displayed=0,frameCount=0,skipped=0;
        const start=performance.now(),starts=Array(sequence.length).fill(null),expected=sequence.map((_,i)=>i*ITEM_MS);
        starts[0]=start;
        const finish=ts=>{
            const actual=starts.map(v=>v==null?null:+(v-start).toFixed(2));
            const errors=actual.map((v,i)=>v==null?null:Math.abs(v-expected[i])).filter(v=>v!=null);
            const mean=errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:null;
            const max=errors.length?Math.max(...errors):null;
            const frameMs=session.frame.frame_ms_estimate||16.7;
            resolve({planned_duration_ms:sequence.length*ITEM_MS,actual_duration_ms:+(ts-start).toFixed(2),item_count:sequence.length,frame_count:frameCount,item_expected_onsets_ms:JSON.stringify(expected),item_actual_onsets_ms:JSON.stringify(actual),timing_error_mean_ms:mean==null?null:+mean.toFixed(2),timing_error_max_ms:max==null?null:+max.toFixed(2),skipped_item_count:skipped,timing_invalid:(max!=null&&max>frameMs+2)||skipped>0?1:0});
        };
        const frame=ts=>{
            frameCount++;
            const elapsed=ts-start;
            const target=Math.min(sequence.length-1,Math.floor(elapsed/ITEM_MS));
            if(target>displayed){
                skipped+=Math.max(0,target-displayed-1);
                displayed=target;
                starts[target]=ts;
                setStimulusImage(stimulusImage,sequence[target]);
            }
            if(elapsed>=sequence.length*ITEM_MS){ finish(ts); return; }
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    });
}

 // 跨浏览器兼容的全屏函数
function enterFullscreen() {
     const elem = document.documentElement;
     const request = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen;
     if (!request) return Promise.resolve(false);
     try {
         const result=request.call(elem);
         return Promise.resolve(result).then(()=>true).catch(error=>{console.warn('无法进入全屏：',error);return false;});
     } catch(error) {
         console.warn('无法进入全屏：',error);
         return Promise.resolve(false);
     }
}
function exitFullscreen() {
     const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
     if (exit && (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement)) {
         const result=exit.call(document);
         if(result?.catch) result.catch(error=>console.warn('无法退出全屏：',error));
     }
}

function shuffle(a){
    for(let i=a.length-1;i>0;i--){
        let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];
    }
    return a;
}

function sectionTwo(level,n=1){
    const a=[];
    [9,10].forEach(T2_pos=>['HH','HN','NH','NN'].forEach(T2=>{for(let i=0;i<n;i++)a.push({level,T2,T2_pos});}));
    return shuffle(a);
}

function sectionThree(level,n=1){
    const a=[];
    // Zero-based positions 4/5 correspond to the fifth/sixth RSVP items.
    [4,5].forEach(T1_pos=>['lag3','lag5','lag8'].forEach(lag=>['SS','CC'].forEach(T1=>['HH','HN','NH','NN'].forEach(T2=>{for(let i=0;i<n;i++)a.push({level,T1_pos,lag,T1,T2});}))));return shuffle(a);
}

const wait=t=>({
    type:jsPsychHtmlKeyboardResponse,
    stimulus:`<p class="rest-message">${t}</p><p class="continue-message">按空格键继续</p>`,
    choices:[' ','q','Q'],
    on_finish:d=>{
        if(d.response==='q'||d.response==='Q')
            terminateExperiment();
        }
    }
);

const guide=f=>({
    type:jsPsychHtmlKeyboardResponse,
    stimulus:`<div class="instruction"><img src="stimuli/${f}.png"></div><p class="continue-message">按空格键继续</p>`,choices:[' ','q','Q'],
    on_finish:d=>{
        if(d.response==='q'||d.response==='Q')
            terminateExperiment();
        }
    }
);

const cue=l=>({
    type:jsPsychHtmlKeyboardResponse,
    stimulus:`<p class="cue-message" style="color:${l==='global'?'red':'#6699ff'}">判断${l==='global'?'大':'小'}字母</p>`,
    choices:'NO_KEYS',
    trial_duration:CUE_MS
});

const fix=()=>({
    type:jsPsychHtmlKeyboardResponse,
    stimulus:'<p style="font-size:48px">+</p>',
    choices:'NO_KEYS',
    trial_duration:FIX_MS
});

const blank=()=>({
    type:jsPsychHtmlKeyboardResponse,
    stimulus:'',
    choices:'NO_KEYS',
    trial_duration:CUE_MS
});

function present(t,section,state){
    return {
        type:jsPsychHtmlKeyboardResponse,
        stimulus:'<div class="rsvp-wrap"></div>',
        choices:'NO_KEYS',
        on_load:()=>{
            const t2=section===3?t.T1_pos+({lag3:3,lag5:5,lag8:8}[t.lag]):t.T2_pos;
            const seq=section===1?[t.T2]:Array.from({length:t2+5},()=>rnd(distractors));
            if(section===3)
                seq[t.T1_pos]=t.T1;
            if(section!==1)
                seq[t2]=t.T2;
            const b=document.querySelector('.rsvp-wrap');
            playImageSequence(b,seq).then(timing=>{
                if(state)state.timing=timing;
                jsPsych.finishTrial(timing||{});
            });
        }
    };
}

function resp(prompt,stim,level,field,state){
    return {
        type:jsPsychHtmlKeyboardResponse,
        stimulus:`<p class="response-message">${prompt}</p>`,
        choices:['f','F','j','J','q','Q'],
        trial_duration:RESP_MS,
        on_finish:d=>{
            const response=(d.response||'').toLowerCase();
            if(response==='q'){
                terminateExperiment();
                return;
            }
            state[field]={resp:response,rt:d.rt==null?null:d.rt,acc:response===keyMap[stim][level]?1:0};}};}

function meta(t){
    return {
        ...session.device,
        ...(session.calibration||{}),
        ...session.quality,
        keyboard_check_passed:session.keyboard_check?.passed||0,
        keyboard_check_order:session.keyboard_check?.detected_keys?.join('')||'',
        frame_rate_estimate_hz:session.frame.refresh_rate_hz||'',
        frame_ms_estimate:session.frame.frame_ms_estimate||'',
        participant_id:info.participant_id,
        subject_id:info.subject_id,
        age:info.age,
        gender:info.gender,
        order:info.order,
        ...t
    };
}

function simple(t,section,practice,practiceState){
    const s={};
    const p=T2_PROMPT;return [
        cue(t.level),
        fix(),
        present(t,section,s),
        resp(p,t.T2,t.level,'T2',s),
        practice?feedback(()=>s.T2?.acc===1?'本次反应正确！':'本次反应错误或超时！'):blank(),
        {
            type:jsPsychHtmlKeyboardResponse,
            stimulus:'',
            choices:'NO_KEYS',
            trial_duration:0,
            on_finish:()=>{
                if(practice&&practiceState){
                    practiceState.rows.push({T2_acc:s.T2?.acc||0});
                }
                if(!practice){
                    const r=meta({...t,T2_resp:s.T2?.resp||'',T2_acc:s.T2?.acc||0,T2_rt:s.T2?.rt,...(s.timing||{})});
                    delete r.T2_pos;
                    if(section===2)
                        r.T2_pos=t.T2_pos+1;
                    results[`section${section}`].push(r);
                }
            }
        }
    ];
}

function feedback(text){
    return {
        type:jsPsychHtmlKeyboardResponse,
        stimulus:()=>`<p class="feedback-message">${typeof text==='function'?text():text}</p>`,choices:'NO_KEYS',
        trial_duration:CUE_MS
    };
}

function sec3Attempt(t,state,practice,attempt,onDone){
    const t2=t.T1_pos+({lag3:3,lag5:5,lag8:8}[t.lag]);
    return [
        cue(t.level),
        fix(),
        present(t,3,state),
        resp(T1_PROMPT,t.T1,t.level,'T1',state),
        resp(T2_PROMPT,t.T2,t.level,'T2',state),
        practice?feedback(()=>state.T1?.acc&&state.T2?.acc?'本次反应均正确！':state.T1?.acc?'图1反应正确\n图2反应错误或超时！':state.T2?.acc?'图2反应正确\n图1反应错误或超时！':'本次反应均错误或超时！'):blank(),
        {
            type:jsPsychHtmlKeyboardResponse,
            stimulus:'',
            choices:'NO_KEYS',
            trial_duration:0,
            on_finish:()=>{
                state.t1acc=state.T1?.acc||0;
                onDone(state,t2,attempt);
            }
        }
    ];
}

function sec3Practice(t,practiceState){
    return sec3Attempt(t,{},true,0,state=>{
        practiceState.rows.push({T1_acc:state.T1?.acc||0,T2_acc:state.T2?.acc||0});
    });
}

function sec3Loop(t,practice){
    const state={}, box={attempt:0}; 
    const save=(s,t2)=>{
        state.t1acc=s.T1?.acc||0;
        if(!practice&&state.t1acc===1)
            results.section3.push(meta({trial:t.trial,lag:t.lag,level:t.level,T1_pos:t.T1_pos+1,T1:t.T1,T1_resp:s.T1?.resp||'',T1_acc:s.T1?.acc||0,T1_rt:s.T1?.rt,T2_pos:t2+1,T2:t.T2,T2_resp:s.T2?.resp||'',T2_acc:s.T2?.acc||0,T2_rt:s.T2?.rt,is_repeated:box.attempt>0?1:0,repeat_time:box.attempt,...(s.timing||{})}));
        }; 
    const node={
        timeline:sec3Attempt(t,state,practice,0,save)
    }; 
    node.loop_function=()=>{
        if(practice||state.t1acc===1)
            return false;
        box.attempt++;
        state.T1=state.T2=undefined;
        node.timeline=sec3Attempt(t,state,practice,box.attempt,save);
        return true;
    }; 
    return node;
}

function sec3Official(t,levelState){
    const state={};
    return sec3Attempt(t,state,false,0,(s,t2)=>{if(s.t1acc===1)results.section3.push(meta({trial:t.trial,lag:t.lag,level:t.level,T1_pos:t.T1_pos+1,T1:t.T1,T1_resp:s.T1?.resp||'',T1_acc:s.T1?.acc||0,T1_rt:s.T1?.rt,T2_pos:t2+1,T2:t.T2,T2_resp:s.T2?.resp||'',T2_acc:s.T2?.acc||0,T2_rt:s.T2?.rt,is_repeated:0,repeat_time:0,...(s.timing||{})}));else levelState.queue.push({trial:t,repeat_time:0});});
}

function sec3Remedial(levelState){
    return {type:jsPsychHtmlKeyboardResponse,stimulus:'<div id="remedial-box" class="rsvp-wrap"></div>',choices:'NO_KEYS',on_load:()=>{
        const box=document.querySelector('#remedial-box'), sleep=ms=>new Promise(r=>setTimeout(r,ms));
        const keypress=(prompt,stim,level)=>new Promise(resolve=>{box.innerHTML=`<p class="response-message">${prompt}</p>`;
        const start=performance.now();
        let done=false;
        const h=e=>{
            const key=e.key.toLowerCase();
            if(done)
                return;
            if(key==='q'){
                done=true;
                window.removeEventListener('keydown',h);
                terminateExperiment();
                return;
            }
            if(key==='f'||key==='j'){
                done=true;
                window.removeEventListener('keydown',h);
                resolve({resp:key,rt:performance.now()-start,acc:key===keyMap[stim][level]?1:0});}};
                window.addEventListener('keydown',h);
                setTimeout(()=>{
                    if(!done){
                        done=true;
                        window.removeEventListener('keydown',h);
                        resolve({resp:'',rt:null,acc:0});
                    }
                },RESP_MS);});
        const run=async()=>{while(levelState.queue.length){const q=levelState.queue.shift(),t=q.trial,attempt=q.repeat_time+1;box.innerHTML=`<p class="cue-message" style="color:${t.level==='global'?'red':'#6699ff'}">判断${t.level==='global'?'大':'小'}字母</p>`;await sleep(CUE_MS);box.innerHTML='<p class="fix-message">+</p>';await sleep(FIX_MS);const t2=t.T1_pos+({lag3:3,lag5:5,lag8:8}[t.lag]),seq=Array.from({length:t2+5},()=>rnd(distractors));seq[t.T1_pos]=t.T1;seq[t2]=t.T2;const timing=await playImageSequence(box,seq);const r1=await keypress(T1_PROMPT,t.T1,t.level),r2=await keypress(T2_PROMPT,t.T2,t.level);if(r1.acc===1)results.section3.push(meta({trial:t.trial,lag:t.lag,level:t.level,T1_pos:t.T1_pos+1,T1:t.T1,T1_resp:r1.resp,T1_acc:r1.acc,T1_rt:r1.rt,T2_pos:t2+1,T2:t.T2,T2_resp:r2.resp,T2_acc:r2.acc,T2_rt:r2.rt,is_repeated:1,repeat_time:attempt,...timing}));else levelState.queue.push({trial:t,repeat_time:attempt});box.innerHTML='';await sleep(BLANK_MS);}jsPsych.finishTrial();};run();}};
}

function addSectionLegacy(tl,sec,lvl,n){
    tl.push(wait(`接下来是${lvl==='global'?'整体':'局部'}图形的练习部分`));
    const p=(sec===3?sectionThree(lvl,1):sectionTwo(lvl,1)).slice(0,8);
    p.forEach(t=>{if(sec===3)tl.push(...sec3Practice(t));else tl.push(...simple(t,sec,true));});
    tl.push(wait(`下面开始实验${sec}正式部分`));const a=sec===3?sectionThree(lvl,n):sectionTwo(lvl,n);if(sec===3){const ls={queue:[]};a.forEach((t,i)=>{t.trial=i+1;tl.push(...sec3Official(t,ls));if((i+1)%48===0&&i<a.length-1)tl.push(wait('休息一下'));});tl.push(wait('请休息一下\\n接下来是补救部分'));tl.push(sec3Remedial(ls));}else a.forEach((t,i)=>{t.trial=i+1;tl.push(...simple(t,sec,false));if((i+1)%48===0&&i<a.length-1)tl.push(wait('请休息一下'));});
}

function practiceSummary(sec,store){
    const rows=store.rows;
    const t2=rows.length?rows.reduce((a,r)=>a+(r.T2_acc===1?1:0),0)/rows.length:0;
    const t1Rows=rows.filter(r=>r.T1_acc!==undefined);
    const t1=t1Rows.length?t1Rows.reduce((a,r)=>a+(r.T1_acc===1?1:0),0)/t1Rows.length:null;
    return {t1,t2,pass:sec===3?(t1>=.70&&t2>=.60):t2>=(sec===1?.85:.75)};
}

function practiceGate(sec,lvl,store){
    return {
        type:jsPsychHtmlKeyboardResponse,
        stimulus:()=>{
            const s=practiceSummary(sec,store);
            const details=sec===3?`T1正确率：${Math.round(s.t1*100)}%；T2正确率：${Math.round(s.t2*100)}%`:`T2正确率：${Math.round(s.t2*100)}%`;
            return `<p class="feedback-message">${lvl==='global'?'整体':'局部'}练习结果</p><p class="practice-result">${details}</p><p class="continue-message">${s.pass?'已达到进入标准，按空格继续。':'未达到进入标准，按空格重新练习。'}</p>`;
        },
        choices:[' ','q','Q'],
        on_finish:d=>{if(d.response==='q'||d.response==='Q')terminateExperiment();}
    };
}

function addPracticeBlock(tl,sec,lvl){
    const trials=(sec===3?sectionThree(lvl,1):sectionTwo(lvl,1)).slice(0,8);
    const store={rows:[],attempt:1};
    const build=()=>{
        store.rows=[];
        const block=[];
        trials.forEach(t=>block.push(...(sec===3?sec3Practice(t,store):simple(t,sec,true,store))));
        block.push(practiceGate(sec,lvl,store));
        return block;
    };
    const node={timeline:build()};
    node.loop_function=()=>{
        if(practiceSummary(sec,store).pass)return false;
        if(store.attempt>=2){terminateExperiment('练习正确率未达到进入标准');return false;}
        store.attempt+=1;
        node.timeline=build();
        return true;
    };
    tl.push(wait(`接下来是${lvl==='global'?'整体':'局部'}图形的练习部分`));
    tl.push(node);
}

function addSection(tl,sec,lvl,n){
    addPracticeBlock(tl,sec,lvl);
    tl.push(wait(`下面开始实验${sec}正式部分`));
    const a=sec===3?sectionThree(lvl,n):sectionTwo(lvl,n);
    if(sec===3){
        const ls={queue:[]};
        a.forEach((t,i)=>{t.trial=i+1;tl.push(...sec3Official(t,ls));if((i+1)%48===0&&i<a.length-1)tl.push(wait('休息一下'));});
        tl.push(wait('请休息一下\\n接下来是补救部分'));
        tl.push(sec3Remedial(ls));
    }else a.forEach((t,i)=>{t.trial=i+1;tl.push(...simple(t,sec,false));if((i+1)%48===0&&i<a.length-1)tl.push(wait('休息一下'));});
}

function csvText(rows,cols){
    const e=v=>JSON.stringify(v==null?'':v);
    return '\ufeff'+cols.join(',')+'\n'+rows.map(r=>cols.map(c=>e(r[c])).join(',')).join('\n');
}

function downloadBlob(filename,text,type='text/plain;charset=utf-8'){
    const a=document.createElement('a'),blob=new Blob([text],{type});
    a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function downloadJSON(){
    downloadBlob(`${info.subject_id||'participant'}_RSVP_session.json`,JSON.stringify({participant:info,session,results},null,2),'application/json;charset=utf-8');
}

function availableResultSections(){
    return [1,2,3].filter(section=>results[`section${section}`].length>0);
}

function downloadExistingResults(){
    const sections=availableResultSections();
    if(sections.length)downloadZip(sections);
}

function abortScreenHTML(){
    const hasFormalResults=availableResultSections().length>0;
    const zipButton=hasFormalResults
        ?'<button type="button" onclick="downloadExistingResults()" class="download-button">下载已有 CSV 数据</button>'
        :'';
    const jsonClass=hasFormalResults?'download-button secondary':'download-button';
    return `<div class="card abort-card"><div class="abort-mark" aria-hidden="true">!</div><h2 class="abort-title">实验已终止</h2><div class="abort-reason"><span>终止原因</span><strong>${session.abort_reason||'实验未完成'}</strong></div><p class="abort-copy">已完成的实验记录仍然保留，请下载后再关闭页面。</p><div class="button-row abort-actions">${zipButton}<button type="button" onclick="downloadJSON()" class="${jsonClass}">下载 JSON 备份</button></div><p class="abort-note">下载完成后即可关闭此页面</p></div>`;
}

function downloadZip(sections='all'){
    if(typeof JSZip==='undefined'){
        alert('无法加载 ZIP 组件，请检查网络连接后重试。');
        return;
    }
    const requested=sections==='all'||sections==null?[1,2,3]:Array.isArray(sections)?sections:[sections];
    const selected=[...new Set(requested.map(value=>{
        if(typeof value==='string'){
            const match=value.match(/(?:section)?\s*([123])/i);
            return match?Number(match[1]):Number(value);
        }
        return Number(value);
    }).filter(value=>[1,2,3].includes(value)))];
    if(!selected.length){
        alert('请选择有效的 section：1、2 或 3。');
        return;
    }
    const zip=new JSZip();
    const files={
        1:{rows:results.section1,cols:['participant_id','subject_id','age','gender','order','trial','level','T2','T2_resp','T2_acc','T2_rt']},
        2:{rows:results.section2,cols:['participant_id','subject_id','age','gender','order','trial','level','T2_pos','T2','T2_resp','T2_acc','T2_rt']},
        3:{rows:results.section3,cols:['participant_id','subject_id','age','gender','order','trial','lag','level','T1_pos','T1','T1_resp','T1_acc','T1_rt','T2_pos','T2','T2_resp','T2_acc','T2_rt','is_repeated','repeat_time']}
    };
    const addObservedColumns=(base,rows)=>base.concat([...new Set(rows.flatMap(row=>Object.keys(row)))].filter(c=>!base.includes(c)));
    selected.forEach(section=>{
        const file=files[section];
        zip.file(`${info.subject_id}_section${section}.csv`,csvText(file.rows,addObservedColumns(file.cols,file.rows)));
    });
    zip.generateAsync({type:'blob'}).then(blob=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=selected.length===3?`${info.subject_id}_RSVP_results.zip`:`${info.subject_id}_section${selected.join('-')}.zip`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    });
}


function disableChineseInputAndHideMouse(){
    /* Browsers cannot switch the operating-system IME directly. These HTML
       hints disable IME mode where supported and request a Latin keyboard. */
    document.documentElement.lang='en';
    document.querySelectorAll('input, textarea').forEach(el=>{
        el.style.imeMode='inactive';
        el.setAttribute('inputmode','latin');
        el.setAttribute('lang','en');
        el.setAttribute('spellcheck','false');
        el.blur();
    });
    document.documentElement.classList.add('experiment-running');
    document.body.classList.add('experiment-running');
    document.documentElement.style.cursor='none';
    document.body.style.cursor='none';
}

function calibrationTrial(){
    let aspectWarningShown=false;
    return {
        type:jsPsychHtmlKeyboardResponse,
        stimulus:`<div class="card"><h2>实验前：屏幕尺寸与观看距离测量</h2><p>请用直尺或卷尺测量屏幕<strong>实际显示区域</strong>，不要把屏幕边框算入；并测量双眼到屏幕显示面的距离，单位为厘米。</p><div class="measure-diagram"><div class="monitor"></div><div><p class="arrow-x">① 屏幕宽度：显示画面的水平长度</p><p class="arrow-y">② 屏幕高度：显示画面的垂直长度</p><p class="eye-line">③ 观看距离：双眼到屏幕显示面的距离</p></div></div><form id="calibration-form"><div class="form-row"><label>屏幕宽度（cm）</label><input id="screen-width" type="number" step="0.1" required></div><div class="form-row"><label>屏幕高度（cm）</label><input id="screen-height" type="number" step="0.1" required></div><div class="form-row"><label>观看距离（cm）</label><input id="view-distance" type="number" step="0.1" required></div><p id="calibration-error" style="color:#f88;min-height:24px"></p><button type="submit">完成测量</button></form><p class="small">程序将根据这些数据把复合字母调整到约 ${GLOBAL_DEG_H}° 高、${GLOBAL_DEG_W}° 宽的整体视觉角度。</p></div>`,
        choices:'NO_KEYS',
        on_load:()=>{
            document.querySelector('#calibration-form').onsubmit=e=>{
                e.preventDefault();
                const w=Number(document.querySelector('#screen-width').value),h=Number(document.querySelector('#screen-height').value),d=Number(document.querySelector('#view-distance').value),err=document.querySelector('#calibration-error');
                if(!reasonableCalibration(w,h,d)){err.textContent='请确认数值合理，单位为厘米：屏幕宽10—150、高6—100、距离30—150。';return;}
                session.calibration=calcCalibration(w,h,d);
                if(session.calibration.calibration_status!=='ok'&&!aspectWarningShown){
                    err.textContent='输入的屏幕宽高比与浏览器报告差异较大，请检查是否把边框算入；确认无误可再次提交。';
                    aspectWarningShown=true;
                    return;
                }
                if(session.calibration.calibration_status!=='ok')
                    session.calibration.calibration_status='warning_aspect_confirmed';
                jsPsych.finishTrial();
            };
        }
    };
}

function keyboardCheckFJQ(){
    return {
        type:jsPsychHtmlKeyboardResponse,
        stimulus:'<div class="card"><h2>键盘检测</h2><p>请按下 <strong>F、J、Q</strong> 三个按键（任意顺序）。</p><p id="keyboard-check-status" class="small">已检测：无</p><p class="small">三个按键全部检测到后，程序才会进入全屏准备。</p></div>',
        choices:'NO_KEYS',
        on_load:()=>{
            const required=['f','j','q'];
            const detected=new Set();
            const detectedAt={};
            const start=performance.now();
            const status=document.querySelector('#keyboard-check-status');
            const update=()=>{
                const labels=required.filter(key=>detected.has(key)).map(key=>key.toUpperCase());
                status.textContent=`已检测：${labels.length?labels.join('、'):'无'}`;
            };
            const handler=e=>{
                const key=e.key.toLowerCase();
                if(!required.includes(key)||detected.has(key))return;
                detected.add(key);
                detectedAt[key]=+(performance.now()-start).toFixed(2);
                update();
                if(detected.size===required.length){
                    window.removeEventListener('keydown',handler);
                    session.keyboard_check={
                        passed:1,
                        required_keys:required.map(key=>key.toUpperCase()),
                        detected_keys:Array.from(detected).map(key=>key.toUpperCase()),
                        detected_at_ms:detectedAt
                    };
                    jsPsych.finishTrial({keyboard_check_passed:1,keyboard_check_order:session.keyboard_check.detected_keys.join('')});
                }
            };
            window.addEventListener('keydown',handler);
        }
    };
}

function fullscreenPrompt(){
    return {
        type:jsPsychHtmlKeyboardResponse,
        stimulus:'<div class="card"><h2>全屏准备</h2><p>屏幕测量已完成。正式实验需要全屏显示并隐藏鼠标，请关闭无关窗口后点击下方按钮。</p><div class="button-row"><button id="enter-fullscreen" type="button">进入全屏</button></div></div>',
        choices:'NO_KEYS',
        on_load:()=>{
            document.querySelector('#enter-fullscreen').onclick=()=>{
                disableChineseInputAndHideMouse();
                enterFullscreen().finally(()=>jsPsych.finishTrial());
            };
        }
    };
}

function refreshRateTrial(){
    return {
        type:jsPsychHtmlKeyboardResponse,
        stimulus:'<h2>设备时序检测</h2><p>正在估计屏幕刷新间隔，请保持窗口不动。</p>',
        choices:'NO_KEYS',
        on_load:()=>{
            const times=[];
            const step=ts=>{times.push(ts);if(times.length>=70){const diffs=times.slice(1).map((t,i)=>t-times[i]);const mean=diffs.reduce((a,b)=>a+b,0)/diffs.length;session.frame={frame_ms_estimate:+mean.toFixed(2),refresh_rate_hz:+(1000/mean).toFixed(2),refresh_samples:diffs.length};jsPsych.finishTrial({frame_ms_estimate:session.frame.frame_ms_estimate,refresh_rate_hz:session.frame.refresh_rate_hz});}else requestAnimationFrame(step);};
            requestAnimationFrame(step);
        }
    };
}

function form(){
    return {
        type:jsPsychHtmlKeyboardResponse,
        stimulus:'<div class="card"><h2>欢迎参加心理学实验</h2><p>请先填写被试信息，确认无误后开始实验。</p><form id="sf"><div class="form-row"><label>被试编号</label><input id="pid" inputmode="numeric" required></div><div class="form-row"><label>姓名/匿名代号</label><input id="sid" required></div><div class="form-row"><label>年龄</label><input id="age" type="number" min="18" max="35" required></div><div class="form-row"><label>性别</label><select id="gender"><option value="女">女</option><option value="男">男</option><option value="其他/不便说明">其他/不便说明</option></select></div><div class="button-row"><button type="submit">提交并继续</button></div></form><p id="err" style="color:#f88"></p></div>',
        choices:'NO_KEYS',
        on_load:()=>{
            document.querySelector('#sf').onsubmit=e=>{
                e.preventDefault();
                const pid=document.querySelector('#pid').value.trim(),sid=document.querySelector('#sid').value.trim(),age=Number(document.querySelector('#age').value),err=document.querySelector('#err');
                if(!/^\d+$/.test(pid)){
                    err.textContent='被试编号必须为数字。';
                    return;
                }
                if(!sid){
                    err.textContent='请填写姓名或匿名代号。';
                    return;
                }
                if(!Number.isInteger(age)||age<18||age>35){
                    err.textContent='年龄需为18到35岁的整数。';
                    return;
                }
                Object.assign(info,{participant_id:pid,subject_id:sid,age:String(age),gender:document.querySelector('#gender').value,order:+pid%2===0?'global->local':'local->global'});
                const levels=+pid%2===0?['global','local']:['local','global'];
                const tl=[];
                tl.push(calibrationTrial());
                tl.push(keyboardCheckFJQ());
                tl.push(fullscreenPrompt());
                tl.push(refreshRateTrial());
                tl.push(guide('section1'));
                levels.forEach(l=>addSection(tl,1,l,1));
                tl.push(guide('section2'));
                levels.forEach(l=>addSection(tl,2,l,4));
                tl.push(guide('section3'));
                levels.forEach(l=>addSection(tl,3,l,2));
                tl.push({
                    type:jsPsychHtmlKeyboardResponse,
                    stimulus:'<h2>实验完成，谢谢参与！</h2><p class="continue-message">请点击下方按钮下载全部实验数据</p><button id="download-results" class="download-button">下载 ZIP 数据包</button><button id="download-json" class="download-button">下载 JSON 备份</button>',
                    choices:'NO_KEYS',
                    on_load:()=>{
                        exitFullscreen();
                        document.documentElement.classList.remove('experiment-running');
                        document.body.classList.remove('experiment-running');
                        document.documentElement.style.cursor='auto';
                        document.body.style.cursor='auto';
                        document.querySelector('#download-results').onclick=()=>{
                            downloadZip('all');
                            jsPsych.finishTrial();
                        };
                        document.querySelector('#download-json').onclick=()=>downloadJSON();
                    }
                });
                jsPsych.addNodeToEndOfTimeline({timeline:tl});
                jsPsych.finishTrial();
            };
        }
        
    };
}

var jsPsych=initJsPsych({
    on_finish:()=>{
        document.documentElement.classList.remove('experiment-running');
        document.body.classList.remove('experiment-running');
        document.documentElement.style.cursor='auto';
        document.body.style.cursor='auto';
        exitFullscreen();
        if(experimentAborted){
            jsPsych.getDisplayElement().innerHTML=abortScreenHTML();
        }else{
            jsPsych.getDisplayElement().innerHTML='<h2>数据已下载</h2>';
        }
    }
});
// Capture device metadata and install focus/fullscreen quality listeners at experiment start.
session.device=deviceMeta();
installQualityLogging();
jsPsych.run([Preloadpicture,DecodePictures,form()]);
