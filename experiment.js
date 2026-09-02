const ITEM_MS=90,CUE_MS=500,FIX_MS=300,RESP_MS=3000;
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
const info={}, results={section1:[],section2:[],section3:[]};
let experimentAborted=false;

function terminateExperiment(){
    experimentAborted=true;
    jsPsych.endExperiment('<p class="termination-message">实验已终止</p>');
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
}

function playImageSequence(container,sequence){
    return new Promise(resolve=>{
        container.innerHTML='';
        const stimulusImage=document.createElement('img');
        stimulusImage.className='stim-img';
        // RSVP 刺激不能显示替代文本；alt 文本会在图片 src 尚未设置或
        // 图片尚未完成解码时被浏览器绘制出来，造成短暂的文字闪现。
        stimulusImage.alt='';
        stimulusImage.setAttribute('aria-hidden','true');
        stimulusImage.decoding='sync';
        stimulusImage.src=`stimuli/${sequence[0]}.png`;
        container.appendChild(stimulusImage);
        let index=1;
        // 第一张图片在插入后完整占用一个 ITEM_MS 时段；否则第一帧
        // 可能在下一次 requestAnimationFrame 时立刻被跳过。
        let nextChange=performance.now()+ITEM_MS;
        const frame=now=>{
            if(now>=nextChange){
                if(index>=sequence.length){resolve();return;}
                stimulusImage.src=`stimuli/${sequence[index++]}.png`;
                nextChange+=ITEM_MS;
            }
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    });
}

 // 跨浏览器兼容的全屏函数
function enterFullscreen() {
     const elem = document.documentElement;
     const request = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen;
     if (request) {
         const result=request.call(elem);
         if(result?.catch) result.catch(error=>console.warn('无法进入全屏：',error));
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
    [3,4].forEach(T1_pos=>['lag3','lag5','lag8'].forEach(lag=>['SS','CC'].forEach(T1=>['HH','HN','NH','NN'].forEach(T2=>{for(let i=0;i<n;i++)a.push({level,T1_pos,lag,T1,T2});}))));return shuffle(a);
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

function present(t,section){
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
            playImageSequence(b,seq).then(()=>jsPsych.finishTrial({}));
        }
    };
}

function resp(prompt,stim,level,field,state){
    return {
        type:jsPsychHtmlKeyboardResponse,
        stimulus:`<p class="response-message">${prompt}</p>`,
        choices:['f','j','q','Q'],
        trial_duration:RESP_MS,
        on_finish:d=>{
            if(d.response==='q'||d.response==='Q'){
                terminateExperiment();
                return;
            }
            state[field]={resp:d.response||'',rt:d.rt==null?null:d.rt,acc:d.response===keyMap[stim][level]?1:0};}};}

function meta(t){
    return {
        participant_id:info.participant_id,
        subject_id:info.subject_id,
        age:info.age,
        gender:info.gender,
        order:info.order,
        ...t
    };
}

function simple(t,section,practice){
    const s={};
    const p=T2_PROMPT;return [
        cue(t.level),
        fix(),
        present(t,section),
        resp(p,t.T2,t.level,'T2',s),
        practice?feedback(()=>s.T2?.acc===1?'本次反应正确！':'本次反应错误或超时！'):blank(),
        {
            type:jsPsychHtmlKeyboardResponse,
            stimulus:'',
            choices:'NO_KEYS',
            trial_duration:0,
            on_finish:()=>{
                if(!practice){
                    const r=meta({...t,T2_resp:s.T2?.resp||'',T2_acc:s.T2?.acc||0,T2_rt:s.T2?.rt});
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
        present(t,3),
        resp(T1_PROMPT,t.T1,t.level,'T1',state),
        resp(T2_PROMPT,t.T2,t.level,'T2',state),
        practice?feedback(()=>state.T1?.acc&&state.T2?.acc?'本次反应均正确！':state.T1?.acc?'图1反应正确\n图2反应错误或超时！':state.T2?.acc?'图2反应正确\n图1反应错误或超时！':'本次反应均错误或超时！'):blank(),
        {
            type:jsPsychHtmlKeyboardResponse,
            stimulus:'',
            choices:'NO_KEYS',
            trial_duration:0,
            on_finish:()=>{
                state.t1acc=state.T1?.acc||0;onDone(state,t2,attempt);
            }
        }
    ];
}

function sec3Practice(t){
    return sec3Attempt(t,{},true,0,()=>{});
}

function sec3Loop(t,practice){
    const state={}, box={attempt:0}; 
    const save=(s,t2)=>{
        state.t1acc=s.T1?.acc||0;
        if(!practice&&state.t1acc===1)
            results.section3.push(meta({trial:t.trial,lag:t.lag,level:t.level,T1_pos:t.T1_pos+1,T1:t.T1,T1_resp:s.T1?.resp||'',T1_acc:s.T1?.acc||0,T1_rt:s.T1?.rt,T2_pos:t2+1,T2:t.T2,T2_resp:s.T2?.resp||'',T2_acc:s.T2?.acc||0,T2_rt:s.T2?.rt,is_repeated:box.attempt>0?1:0,repeat_time:box.attempt}));
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
    return sec3Attempt(t,state,false,0,(s,t2)=>{if(s.t1acc===1)results.section3.push(meta({trial:t.trial,lag:t.lag,level:t.level,T1_pos:t.T1_pos+1,T1:t.T1,T1_resp:s.T1?.resp||'',T1_acc:s.T1?.acc||0,T1_rt:s.T1?.rt,T2_pos:t2+1,T2:t.T2,T2_resp:s.T2?.resp||'',T2_acc:s.T2?.acc||0,T2_rt:s.T2?.rt,is_repeated:0,repeat_time:0}));else levelState.queue.push({trial:t,repeat_time:0});});
}

function sec3Remedial(levelState){
    return {type:jsPsychHtmlKeyboardResponse,stimulus:'<div id="remedial-box" class="rsvp-wrap"></div>',choices:'NO_KEYS',on_load:()=>{
        const box=document.querySelector('#remedial-box'), sleep=ms=>new Promise(r=>setTimeout(r,ms));
        const keypress=(prompt,stim,level)=>new Promise(resolve=>{box.innerHTML=`<p class="response-message">${prompt}</p>`;
        const start=performance.now();
        let done=false;
        const h=e=>{
            if(done)
                return;
            if(e.key==='q'||e.key==='Q'){
                terminateExperiment();
                return;
            }
            if(e.key==='f'||e.key==='j'){
                done=true;
                window.removeEventListener('keydown',h);
                resolve({resp:e.key,rt:performance.now()-start,acc:e.key===keyMap[stim][level]?1:0});}};
                window.addEventListener('keydown',h);
                setTimeout(()=>{
                    if(!done){
                        done=true;
                        window.removeEventListener('keydown',h);
                        resolve({resp:'',rt:null,acc:0});
                    }
                },RESP_MS);});
        const run=async()=>{while(levelState.queue.length){const q=levelState.queue.shift(),t=q.trial,attempt=q.repeat_time+1;box.innerHTML=`<p class="cue-message" style="color:${t.level==='global'?'red':'#6699ff'}">判断${t.level==='global'?'大':'小'}字母</p>`;await sleep(CUE_MS);box.innerHTML='<p class="fix-message">+</p>';await sleep(FIX_MS);const t2=t.T1_pos+({lag3:3,lag5:5,lag8:8}[t.lag]),seq=Array.from({length:t2+5},()=>rnd(distractors));seq[t.T1_pos]=t.T1;seq[t2]=t.T2;await playImageSequence(box,seq);const r1=await keypress(T1_PROMPT,t.T1,t.level),r2=await keypress(T2_PROMPT,t.T2,t.level);if(r1.acc===1)results.section3.push(meta({trial:t.trial,lag:t.lag,level:t.level,T1_pos:t.T1_pos+1,T1:t.T1,T1_resp:r1.resp,T1_acc:r1.acc,T1_rt:r1.rt,T2_pos:t2+1,T2:t.T2,T2_resp:r2.resp,T2_acc:r2.acc,T2_rt:r2.rt,is_repeated:1,repeat_time:attempt}));else levelState.queue.push({trial:t,repeat_time:attempt});box.innerHTML='';await sleep(CUE_MS);}jsPsych.finishTrial();};run();}};
}

function addSection(tl,sec,lvl,n){
    tl.push(wait(`接下来是${lvl==='global'?'整体':'局部'}图形的练习部分`));
    const p=(sec===3?sectionThree(lvl,1):sectionTwo(lvl,1)).slice(0,8);
    p.forEach(t=>{if(sec===3)tl.push(...sec3Practice(t));else tl.push(...simple(t,sec,true));});
    tl.push(wait(`下面开始实验${sec}正式部分`));const a=sec===3?sectionThree(lvl,n):sectionTwo(lvl,n);if(sec===3){const ls={queue:[]};a.forEach((t,i)=>{t.trial=i+1;tl.push(...sec3Official(t,ls));if((i+1)%48===0&&i<a.length-1)tl.push(wait('休息一下'));});tl.push(wait('请休息一下\\n接下来是补救部分'));tl.push(sec3Remedial(ls));}else a.forEach((t,i)=>{t.trial=i+1;tl.push(...simple(t,sec,false));if((i+1)%48===0&&i<a.length-1)tl.push(wait('请休息一下'));});
}

function csvText(rows,cols){
    const e=v=>JSON.stringify(v==null?'':v);
    return '\ufeff'+cols.join(',')+'\n'+rows.map(r=>cols.map(c=>e(r[c])).join(',')).join('\n');
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
    selected.forEach(section=>{
        const file=files[section];
        zip.file(`${info.subject_id}_section${section}.csv`,csvText(file.rows,file.cols));
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
    document.body.classList.add('experiment-running');
    document.documentElement.style.cursor='none';
    document.body.style.cursor='none';
}

function form(){
    return {
        type:jsPsychHtmlKeyboardResponse,
        stimulus:'<h2>欢迎参加心理学实验</h2><p>请先填写被试信息，确认无误后开始实验。</p><form id="sf"><div class="form-row"><label>被试编号</label><input id="pid"></div><div class="form-row"><label>用户名</label><input id="sid"></div><div class="form-row"><label>年龄</label><input id="age" type="number"></div><div class="form-row"><label>性别</label><select id="gender"><option value="M">M</option><option value="F">F</option></select></div><button>确定</button></form><p id="err" style="color:#f88"></p>',
        choices:'NO_KEYS',
        on_load:()=>{
            document.querySelector('#sf').onsubmit=e=>{
                e.preventDefault();
                const pid=document.querySelector('#pid').value.trim(),sid=document.querySelector('#sid').value.trim(),age=Number(document.querySelector('#age').value),err=document.querySelector('#err');
                if(!/^\d+$/.test(pid)||+pid<=0){
                    err.textContent='被试编号必须是大于0的数字。';
                    return;
                }
                if(!sid){
                    err.textContent='请输入用户名。';
                    return;
                }
                if(!Number.isInteger(age)||age<6||age>100){
                    err.textContent='年龄需为6到100岁的整数。';
                    return;
                }
                Object.assign(info,{participant_id:String(+pid),subject_id:sid,age:String(age),gender:document.querySelector('#gender').value,order:+pid%2===0?'global->local':'local->global'});
                enterFullscreen();
                disableChineseInputAndHideMouse();
                const levels=+pid%2===0?['global','local']:['local','global'];
                const tl=[];
                tl.push(guide('section1'));
                levels.forEach(l=>addSection(tl,1,l,1));
                tl.push(guide('section2'));
                levels.forEach(l=>addSection(tl,2,l,4));
                tl.push(guide('section3'));
                levels.forEach(l=>addSection(tl,3,l,2));
                tl.push({
                    type:jsPsychHtmlKeyboardResponse,
                    stimulus:'<h2>实验完成，谢谢参与！</h2><p class="continue-message">请点击下方按钮下载全部实验数据</p><button id="download-results" class="download-button">下载 ZIP 数据包</button>',
                    choices:'NO_KEYS',
                    on_load:()=>{
                        exitFullscreen();
                        document.body.classList.remove('experiment-running');
                        document.documentElement.style.cursor='auto';
                        document.body.style.cursor='auto';
                        document.querySelector('#download-results').onclick=()=>{
                            downloadZip(1);
                            jsPsych.finishTrial();
                        };
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
        document.body.classList.remove('experiment-running');
        exitFullscreen();
        if(experimentAborted){
            jsPsych.getDisplayElement().innerHTML='<p class="termination-message">实验已终止</p><p class="continue-message">按空格键关闭页面</p>';
        }else{
            jsPsych.getDisplayElement().innerHTML='<h2>数据已下载</h2>';
        }
    }
});
jsPsych.run([Preloadpicture,form()]);
