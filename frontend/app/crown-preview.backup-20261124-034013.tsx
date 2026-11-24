/**
 * FX CALL — Crown UI visual sandbox.
 * Standalone, read-only demonstration: no auth mutations or calls are made.
 * Open /crown-preview in the Expo web preview to compare the proposed design.
 */
import React, { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Icon, type IconName } from '@/src/components/ui';
import { useAuth } from '@/src/auth';

const C = {
  base: '#050A12', surface: '#0B1726', surface2: '#112338', field: '#0B1522',
  outline: '#28485D', bright: '#09B8FF', accent: '#289BD8', halo: '#75D5FF',
  text: '#ECF4FA', muted: '#9BAEBE', subtle: '#5F778C', positive: '#34BD92',
  error: '#C85766',
};
const logo = require('../assets/images/logo.png');
const serif: any = Platform.OS === 'ios' ? 'Georgia' : Platform.OS === 'web' ? 'Georgia' : 'serif';

type Page = 'profile' | 'editor' | 'meetings';
type Section = 'email' | 'password' | 'twofa' | 'sessions' | 'privacy' | null;

function CrownTitle({ kicker, title, desc }: { kicker: string; title: string; desc?: string }) {
  return <View style={s.crownHead}>
    <View style={s.crownLine} />
    <Icon name="crown" size={32} color={C.halo} />
    <Text style={s.kicker}>{kicker}</Text>
    <Text style={s.title}>{title}</Text>
    {desc ? <Text style={s.subtitle}>{desc}</Text> : null}
    <View style={s.headRule}><View style={s.ruleLine} /><Icon name="diamond" color={C.accent} size={10}/><View style={s.ruleLine} /></View>
  </View>;
}
function Panel({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[s.panel,style]}><LinearGradient colors={['rgba(34,126,192,0.22)','transparent']} style={s.panelSheen} pointerEvents="none" />{children}</View>;
}
function Action({ title, icon, onPress, secondary = false, disabled = false }: {title: string; icon?: IconName; onPress: ()=>void; secondary?: boolean; disabled?: boolean}) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({pressed}) => [s.action, secondary ? s.actionSecondary : s.actionMain, pressed && {opacity: .75}, disabled && {opacity: .5}]}>
    {icon ? <Icon name={icon} size={17} color={C.text}/> : null}<Text style={s.actionText}>{title}</Text>
  </Pressable>;
}
function Menu({ icon, title, desc, expanded, onPress, extra }: {icon: IconName; title: string; desc: string; expanded: boolean; onPress:()=>void; extra?: React.ReactNode}) {
  return <Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={onPress} style={({pressed})=>[s.menuRow,pressed && {backgroundColor: 'rgba(17,53,82,0.5)'}]}>
    <View style={s.menuIcon}><Icon name={icon} color={C.halo} size={20}/></View>
    <View style={s.menuLabel}><Text style={s.menuTitle}>{title}</Text><Text style={s.menuDesc} numberOfLines={2}>{desc}</Text></View>
    {extra || <Icon name={expanded ? 'chevron-up' : 'chevron-right'} size={18} color={C.muted}/>}
  </Pressable>;
}
function LabeledInput({ label, value, setValue, secure, hint }: {label:string;value:string;setValue:(next:string)=>void;secure?: boolean;hint?: string}) {
  return <View style={s.fieldWrap}>
    <Text style={s.label}>{label}</Text>
    <TextInput value={value} onChangeText={setValue} placeholder={hint} placeholderTextColor={C.subtle} secureTextEntry={!!secure} autoCapitalize="none" style={[s.input,secure && s.secureInput]} />
  </View>;
}

export default function CrownPreview() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState<Page>('profile');
  const [expanded, setExpanded] = useState<Section>(null);
  const [twofa, setTwofa] = useState(false);
  const [message, setMessage] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [draftUri, setDraftUri] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [appliedRotation, setAppliedRotation] = useState(0);
  const [appliedFlip, setAppliedFlip] = useState(false);
  const [appliedZoom, setAppliedZoom] = useState(1);
  const [currentPassword, setCurrentPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const compact = width < 480;

  const flipSection = (section: Exclude<Section,null>) => {setExpanded(old => old === section ? null : section);setMessage('');};
  const openPhoto = () => {setDraftUri(photoUri);setZoom(appliedZoom);setRotation(appliedRotation);setFlipped(appliedFlip);setPage('editor');setMessage('');};
  const pickPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {setMessage('Allow photo access to select an image.');return;}
      const selection = await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:false,quality:0.85});
      if (!selection.canceled && selection.assets[0]?.uri) {
        setDraftUri(selection.assets[0].uri);setZoom(1);setRotation(0);setFlipped(false);setMessage('Photo loaded in preview.');
      }
    } catch {setMessage('Photo picker unavailable here. Try Safari or the installed app.');}
  };
  const photoSource = draftUri ? {uri: draftUri} : logo;
  const src = photoUri ? {uri: photoUri} : logo;

  return <View style={s.root}>
    <LinearGradient colors={['#061322','#050A12','#050A12']} style={StyleSheet.absoluteFill} pointerEvents="none"/>
    <View style={[s.topBar,{paddingTop:insets.top+8}]}>
      <Pressable style={s.topBack} onPress={()=>router.canGoBack() ? router.back() : router.replace('/(tabs)/account')} accessibilityLabel="Return to FX CALL">
        <Icon name="arrow-left" size={20} color={C.text}/>
      </Pressable>
      <View style={s.topCenter}><Icon name="crown" color={C.halo} size={17}/><Text style={s.wordmark}>FX CALL</Text></View>
      <View style={s.demoTag}><Text style={s.demoText}>UI PREVIEW</Text></View>
    </View>
    <ScrollView style={{flex:1}} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content,{paddingBottom:Math.max(insets.bottom,16)+30}]}>
      <View style={{width:'100%',maxWidth:660,alignSelf:'center'}}>
        {page === 'profile' ? <>
          <CrownTitle kicker="CROWN EDITION" title="PROFILE" desc="Your identity. Your privacy. Your rules." />
          <Panel style={{marginBottom:15}}>
            <View style={s.profileIdentity}>
              <Pressable onPress={openPhoto} accessibilityLabel="Edit profile photo" style={s.avatarFrame}>
                <LinearGradient colors={['#1FADEF','#0A213A','#080D18']} style={StyleSheet.absoluteFill}/>
                <View style={s.avatarInner}><Image source={src} resizeMode="contain" style={[s.avatarImage,{transform:[{rotate:`${appliedRotation}deg`},{scaleX:appliedFlip?-appliedZoom:appliedZoom},{scaleY:appliedZoom}]}]}/></View>
                <View style={s.editIcon}><Icon name="pencil" size={13} color={C.text}/></View>
              </Pressable>
              <View style={s.identityCopy}><Text style={s.displayName}>{user?.display_name || 'FX CALL MEMBER'}</Text><Text style={s.memberStatus}>CROWN MEMBER · SECURE ACCOUNT</Text><Text numberOfLines={2} style={s.identityEmail}>{user?.email || 'Current email appears after login'}</Text></View>
            </View>
            <Action title="Edit profile photo" secondary icon="camera" onPress={openPhoto}/>
          </Panel>
          <Panel style={{paddingTop:6,paddingBottom:8}}>
            <Text style={s.panelKicker}>ACCOUNT & SECURITY</Text>
            <Menu icon="mail" title="Email address" desc={user?.email || 'Your verified email'} expanded={expanded==='email'} onPress={()=>flipSection('email')}/>
            {expanded === 'email' ? <View style={s.section}>
              <Text style={s.label}>CURRENT EMAIL</Text>
              <View style={s.currentEmailRow}><Text style={s.currentEmail}>{user?.email || 'Your account email'}</Text><Icon name="badge-check" color={C.positive} size={23}/></View>
              <Text style={s.hint}>To update your real account email, use the existing Profile settings after approving this design.</Text>
              <LabeledInput label="NEW EMAIL · DESIGN PREVIEW" value={newEmail} setValue={setNewEmail} hint="new@email.com" />
              <Action title="Preview verification flow" icon="mail-check" onPress={()=>setMessage('Preview only — no verification email was sent.')}/>
            </View> : null}
            <Menu icon="lock-keyhole" title="Password" desc="Secure password & email verification" expanded={expanded==='password'} onPress={()=>flipSection('password')}/>
            {expanded === 'password' ? <View style={s.section}>
              <LabeledInput label="CURRENT PASSWORD" value={currentPassword} setValue={setCurrentPassword} secure/>
              <Action title="Get code" icon="mail" secondary onPress={()=>setMessage('Preview only — no code was sent. Use your live Profile to change your password.')}/>
              <LabeledInput label="VERIFICATION CODE" value={verificationCode} setValue={setVerificationCode} hint="6-digit code"/>
              <LabeledInput label="NEW PASSWORD" value={newPassword} setValue={setNewPassword} secure/>
              <Action title="Change password · demo" icon="key-round" onPress={()=>setMessage('Demo only — your password has not changed.')}/>
            </View> : null}
            <Menu icon="shield-check" title="Two-factor authentication" desc={twofa?'ON · Preview only':'OFF · Add a sign-in step'} expanded={expanded==='twofa'} onPress={()=>flipSection('twofa')} extra={<Switch accessibilityLabel="Preview two-factor authentication switch" value={twofa} onValueChange={v=>{setTwofa(v);setMessage('Visual preview only — real 2FA remains unchanged.');}} trackColor={{false:'#374353',true:C.accent}} thumbColor="#ECF4FA" style={{transform:[{scaleX:.72},{scaleY:.72}]}}/>}/>
            {expanded === 'twofa' ? <View style={s.section}><Text style={s.hint}>Use the existing Account page to enable actual authenticator-based 2FA. This switch previews the new style only.</Text></View>:null}
            <Menu icon="smartphone" title="Devices & sessions" desc="Review signed-in devices" expanded={expanded==='sessions'} onPress={()=>flipSection('sessions')}/>
            {expanded==='sessions'?<View style={s.section}>
              <View style={s.session}><Icon name="smartphone" color={C.halo} size={20}/><View style={{flex:1}}><Text style={s.sessionName}>Current device</Text><Text style={s.hint}>Active session · Preview</Text></View><Icon name="check-circle-2" color={C.positive} size={18}/></View>
              {confirmation ? <View style={s.confirmRow}><Text style={s.hint}>Would sign out all other devices in the real app.</Text><Action title="Cancel" secondary onPress={()=>setConfirmation(false)}/></View> : <Action title="Sign out other sessions · demo" icon="log-out" secondary onPress={()=>setConfirmation(true)}/>}
            </View>:null}
            <Menu icon="shield" title="Privacy Shield" desc="Security capabilities on this device" expanded={expanded==='privacy'} onPress={()=>flipSection('privacy')}/>
            {expanded==='privacy'?<View style={s.section}><Text style={s.hint}>Screenshot and recording detection depend on the platform. Safari cannot reliably detect these events.</Text></View>:null}
          </Panel>
        </> : null}
        {page === 'editor' ? <>
          <CrownTitle kicker="YOUR IDENTITY" title="EDIT PROFILE PHOTO" desc="Reposition, rotate and flip your photo."/>
          <Panel>
            <Text style={s.panelKicker}>PHOTO EDITOR · LOCAL PREVIEW</Text>
            <View style={s.editorCanvas}>
              <View style={s.cropBounds}>
                <Image source={photoSource} resizeMode="cover" style={[s.cropImage,{transform:[{rotate:`${rotation}deg`},{scaleX:flipped?-zoom:zoom},{scaleY:zoom}]}]}/>
                {(['topLeft','topRight','bottomLeft','bottomRight'] as const).map((corner)=><View key={corner} style={[s.cropCorner,corner.includes('Right')?{right:-6}:{left:-6},corner.includes('bottom')?{bottom:-6}:{top:-6}]} />)}
              </View>
            </View>
            <View style={[s.editTools,compact && {flexWrap:'wrap'}]}>
              <Action title="Rotate left" icon="rotate-ccw" secondary onPress={()=>setRotation(a=>(a-90+360)%360)}/>
              <Action title="Flip horizontal" icon="flip-horizontal" secondary onPress={()=>setFlipped(v=>!v)}/>
            </View>
            <View style={s.zoomRow}><Text style={s.label}>SCALE</Text><Pressable onPress={()=>setZoom(v=>Math.max(1,Math.round((v-.1)*10)/10))} style={s.zoomStep}><Icon name="minus" color={C.text}/></Pressable><Text style={s.zoomAmount}>{Math.round(zoom*100)}%</Text><Pressable onPress={()=>setZoom(v=>Math.min(2.5,Math.round((v+.1)*10)/10))} style={s.zoomStep}><Icon name="plus" color={C.text}/></Pressable></View>
            <Action title="Choose photo" icon="image-plus" secondary onPress={pickPhoto}/>
            <Action title="Apply to preview" icon="check" onPress={()=>{setPhotoUri(draftUri);setAppliedRotation(rotation);setAppliedFlip(flipped);setAppliedZoom(zoom);setPage('profile');setMessage('Visual preview updated. No photo was saved to your account.');}}/>
            <Action title="Cancel" secondary onPress={()=>setPage('profile')}/>
            <Text style={s.hint}>This editor previews the crop and transformations. It does not upload or permanently modify your profile image.</Text>
          </Panel>
        </> : null}
        {page === 'meetings' ? <>
          <CrownTitle kicker="PRIVATE BY DESIGN" title="SECURE ROOMS" desc="Your meetings, framed by the crown."/>
          <Panel style={{gap:14}}>
            <View style={s.meetingHeadline}><Icon name="shield-check" color={C.halo} size={22}/><Text style={s.meetingTitle}>START A SECURE ROOM</Text></View>
            <Text style={s.hint}>Guests enter only by invitation and host approval.</Text>
            <View style={s.meetingPreview}><Icon name="crown" size={44} color={C.halo}/><Text style={s.meetingPreviewText}>THE PRIVATE STAGE</Text><Text style={s.hint}>Crown-framed video stage concept</Text></View>
            <Action title="Open real Meetings" icon="video" onPress={()=>router.replace('/(tabs)/meetings')}/>
          </Panel>
        </>:null}
        {message ? <View style={s.notice}><Icon name="info" size={16} color={C.halo}/><Text style={{color:C.text,flex:1,fontSize:12}}>{message}</Text><Pressable accessibilityLabel="Dismiss notice" onPress={()=>setMessage('')}><Icon name="x" size={18} color={C.muted}/></Pressable></View> : null}
        <View style={s.previewFooter}><Icon name="crown" color={C.halo} size={14}/><Text style={s.footerText}>CROWN UI STUDY · VISUAL DEMO · NO ACCOUNT CHANGES</Text></View>
      </View>
    </ScrollView>
    <View style={[s.nav,{paddingBottom:Math.max(insets.bottom,8)}]}>
      {([{id:'meetings',icon:'video',title:'Meetings'},{id:'profile',icon:'shield',title:'Profile'},{id:'editor',icon:'image',title:'Photo'}] as const).map(item => {
        const active = page === item.id;
        return <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{selected:active}} onPress={()=>item.id==='editor'?openPhoto():setPage(item.id)} style={[s.navItem,active && s.navActive]}>
          <Icon name={item.icon} color={active?C.halo:C.muted} size={21}/><Text style={[s.navText,active&&{color:C.text}]}>{item.title}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const s=StyleSheet.create({
  root:{flex:1,backgroundColor:C.base},
  topBar:{paddingHorizontal:16,paddingBottom:11,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#153B58'},
  topBack:{width:36,height:36,alignItems:'center',justifyContent:'center',borderColor:C.outline,borderWidth:1,borderRadius:6},
  topCenter:{flexDirection:'row',alignItems:'center',gap:8},
  wordmark:{color:C.text,fontFamily:serif,letterSpacing:4,fontSize:15},
  demoTag:{borderWidth:1,borderColor:C.outline,paddingHorizontal:8,paddingVertical:6,borderRadius:5},
  demoText:{color:C.halo,fontSize:9,letterSpacing:1.2},
  content:{padding:16},crownHead:{alignItems:'center',paddingTop:19,paddingBottom:21,overflow:'hidden'},
  crownLine:{position:'absolute',top:13,width:160,height:72,borderTopWidth:1,borderTopColor:C.accent,transform:[{rotate:'-8deg'}],opacity:.9},
  kicker:{color:C.halo,fontSize:10,letterSpacing:3,marginTop:5},
  title:{color:C.text,fontFamily:serif,fontSize:30,letterSpacing:4,marginTop:7,textAlign:'center'},
  subtitle:{color:C.muted,textAlign:'center',fontSize:12,marginTop:8,lineHeight:18},
  headRule:{flexDirection:'row',alignItems:'center',width:155,gap:9,marginTop:18},ruleLine:{height:1,flex:1,backgroundColor:C.outline},
  panel:{backgroundColor:C.surface,borderWidth:1,borderColor:C.outline,borderRadius:6,padding:16,overflow:'hidden'},
  panelSheen:{height:3,position:'absolute',left:0,right:0,top:0},
  profileIdentity:{flexDirection:'row',alignItems:'center',gap:16,marginBottom:14},
  avatarFrame:{width:98,height:102,justifyContent:'center',alignItems:'center',borderWidth:1,borderColor:C.halo,borderRadius:6,overflow:'visible',backgroundColor:C.field},
  avatarInner:{width:86,height:88,overflow:'hidden',backgroundColor:'#030910'},
  avatarImage:{width:86,height:88},editIcon:{position:'absolute',right:-6,bottom:-5,width:26,height:26,backgroundColor:'#174D74',borderRadius:6,borderWidth:1,borderColor:C.halo,alignItems:'center',justifyContent:'center'},
  identityCopy:{flex:1,gap:6},displayName:{fontSize:19,color:C.text,fontFamily:serif,letterSpacing:1.2},
  memberStatus:{fontSize:9,color:C.halo,letterSpacing:1},identityEmail:{fontSize:11,color:C.muted},
  action:{minHeight:43,paddingHorizontal:12,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderRadius:6,flex:1},
  actionMain:{backgroundColor:'#136FAD',borderColor:'#37B9F2'},actionSecondary:{backgroundColor:'#11243A',borderColor:C.outline},
  actionText:{color:C.text,fontSize:11,letterSpacing:.8,fontWeight:'600',textAlign:'center'},
  panelKicker:{color:C.halo,letterSpacing:2.1,fontSize:10,marginBottom:10},
  menuRow:{minHeight:72,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderBottomColor:'#213547',paddingVertical:13},
  menuIcon:{width:42,height:42,backgroundColor:'#10253B',borderWidth:1,borderColor:'#2F5E7E',borderRadius:6,alignItems:'center',justifyContent:'center'},
  menuLabel:{flex:1,gap:5},menuTitle:{fontSize:15,fontWeight:'600',color:C.text},menuDesc:{fontSize:10,letterSpacing:.4,color:C.muted},
  section:{backgroundColor:'#0B1828',borderRadius:6,borderWidth:1,borderColor:C.outline,padding:14,marginTop:10,marginBottom:8,gap:13},
  currentEmailRow:{flexDirection:'row',alignItems:'center',gap:10,flexWrap:'wrap'},currentEmail:{color:C.text,fontSize:19,flexShrink:1},
  hint:{fontSize:12,color:C.muted,lineHeight:18},
  label:{color:C.subtle,fontSize:10,letterSpacing:1.8},
  fieldWrap:{gap:7},input:{backgroundColor:C.field,borderWidth:1,borderColor:'#2A536C',borderRadius:6,minHeight:46,paddingHorizontal:12,color:C.text,fontSize:14},
  secureInput:{backgroundColor:'#142F43',borderColor:'#346F95'},
  session:{flexDirection:'row',alignItems:'center',gap:12,borderColor:C.outline,borderWidth:1,borderRadius:6,padding:12},sessionName:{color:C.text,fontSize:13},
  confirmRow:{gap:8},
  editorCanvas:{height:320,backgroundColor:'#030A12',borderWidth:1,borderColor:C.outline,borderRadius:6,alignItems:'center',justifyContent:'center',marginVertical:8},
  cropBounds:{width:232,height:232,borderWidth:1,borderColor:C.halo,overflow:'visible',alignItems:'center',justifyContent:'center',backgroundColor:'#000'},
  cropImage:{width:230,height:230},cropCorner:{position:'absolute',height:12,width:12,borderRadius:6,backgroundColor:'#E7F8FF',borderWidth:1,borderColor:C.outline},
  editTools:{flexDirection:'row',gap:8,justifyContent:'space-between'},
  zoomRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:5},
  zoomStep:{padding:9,borderRadius:6,borderColor:C.outline,borderWidth:1},zoomAmount:{color:C.text,fontSize:14},
  notice:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#15334B',borderColor:C.accent,borderWidth:1,borderRadius:6,padding:12,marginTop:16},
  previewFooter:{alignItems:'center',gap:8,marginTop:22,marginBottom:3},footerText:{color:C.subtle,letterSpacing:1,fontSize:9,textAlign:'center'},
  meetingHeadline:{flexDirection:'row',alignItems:'center',gap:12},meetingTitle:{fontFamily:serif,color:C.text,letterSpacing:2,fontSize:17},
  meetingPreview:{height:220,backgroundColor:'#030911',alignItems:'center',justifyContent:'center',gap:10,borderWidth:1,borderColor:'#1E4964',borderRadius:6},
  meetingPreviewText:{color:C.halo,fontFamily:serif,fontSize:19,letterSpacing:3},
  nav:{backgroundColor:'#07111E',borderTopWidth:1,borderTopColor:C.outline,flexDirection:'row',gap:8,paddingTop:9,paddingHorizontal:14,justifyContent:'space-evenly'},
  navItem:{flex:1,alignItems:'center',justifyContent:'center',gap:5,padding:8,borderWidth:1,borderColor:'transparent',borderRadius:6},
  navActive:{backgroundColor:'#10243B',borderColor:'#285B7C'},navText:{fontSize:11,color:C.muted},
});
