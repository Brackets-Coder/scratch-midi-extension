//This is the Scratch port of the Turbowarp MIDI extension, which is not yet officially published.

let midiInputDevices = [];
let midiDeviceInfo = [];
let notesOn = [];
let noteVelocities = [];
let lastNotePressed = 0;
let lastNoteReleased = 0;

if (navigator.requestMIDIAccess) {
  navigator.requestMIDIAccess().then(onSuccess, onError);
  
  function onSuccess(midiAccess) {
    midiAccess.onstatechange = (event) => {
      if (event.port.state == "connected") {
        midiInputDevices.push([`[id: "${event.port.id}"` + ` name: "${event.port.name}"]`]);
        midiDeviceInfo.push([event.port.id, event.port.name]);
        
      } else if (event.port.state == "disconnected") {
        midiInputDevices.splice([`[id: "${event.port.id}"` + ` name: "${event.port.name}"]`], 1);
        midiDeviceInfo.splice([event.port.id, event.port.name]);
      }
    };

    function onMIDIMessage(event) {
      const [status, note, velocity] = event.data;
      const command = status & 0xF0;
      if (command === 0x90 && velocity > 0) {
        notesOn.push(note);
        noteVelocities.push([note, velocity]);
        lastNotePressed = note;
        Scratch.vm.runtime.startHats('midi_whenNotePressed');
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
        lastNoteReleased = note;
        notesOn.splice(notesOn.indexOf(note), 1);
        noteVelocities.splice(noteVelocities.findIndex(subArray => subArray[0] === note), 1);
        Scratch.vm.runtime.startHats('midi_whenNoteReleased');
      } else {
        console.log(`Other MIDI Message: Status=${status}, Note=${note}, Velocity=${velocity}, Timestamp ${event.timeStamp}`);
      }
    }

    midiAccess.inputs.forEach((entry) => {
      entry.onmidimessage = onMIDIMessage;
    });
  }

  function onError(err) {
    alert("MIDI Access Error:", err);
    throw new Error("MIDI Access Error:", err);
  }

} else {
  alert("MIDI is not supported on this browser.");
  throw new Error("MIDI is not supported on this browser.");
}

class MIDI {
  constructor (runtime) {
    /**
     * Store this for later communication with the Scratch VM runtime.
     * If this extension is running in a sandbox then `runtime` is an async proxy object.
     * @type {Runtime}
     */
    this.runtime = runtime;
  }
  getInfo() {
    return {
      id: 'midi',
      name: 'MIDI',
      blocks: [
        {
          opcode: 'MIDIinputDevices',
          blockType: Scratch.BlockType.REPORTER,
          text: 'connected MIDI input devices',
          disableMonitor: true,
        },
        {
          opcode: 'midiDeviceInfo',
          blockType: Scratch.BlockType.REPORTER,
          text: '[info] of MIDI device [number]',
          arguments: {
            info: {
              type: Scratch.ArgumentType.STRING,
              defaultValue: 'name',
              menu: 'infoMenu',
            },
            number: {
              type: Scratch.ArgumentType.NUMBER,
              defaultValue: 0,
            }
          }
        },
        '---',
        {
          opcode: 'whenNotePressed',
          blockType: Scratch.BlockType.EVENT,
          text: 'when any note pressed',
          isEdgeActivated: false,
          shouldRestartExistingThreads: true,
        },
        {
          opcode: 'whenNoteReleased',
          blockType: Scratch.BlockType.EVENT,
          text: 'when any note released',
          isEdgeActivated: false,
          shouldRestartExistingThreads: true,
        },
        {
          opcode: 'noteOn',
          blockType: Scratch.BlockType.BOOLEAN,
          text: 'is note [note] on?',
          arguments: {
            note: {
              type: Scratch.ArgumentType.NOTE,
              defaultValue: 60,
            }
          }
        },
        {
          opcode: 'noteVelocity',
          blockType: Scratch.BlockType.REPORTER,
          text: 'velocity of note [note]',
          arguments: {
            note: {
              type: Scratch.ArgumentType.NOTE,
              defaultValue: 60,
            }
          }
        },
        {
          opcode: 'activeNotes',
          blockType: Scratch.BlockType.REPORTER,
          text: 'all active notes',
          disableMonitor: true,
        },
        {
          opcode: 'lastNotePressed',
          blockType: Scratch.BlockType.REPORTER,
          text: 'last note pressed',
          disableMonitor: true,
        },
        {
          opcode: 'lastNoteReleased',
          blockType: Scratch.BlockType.REPORTER,
          text: 'last note released',
          disableMonitor: true,
        }
      ],
      menus: {
        infoMenu: {
          acceptReporters: false,
          items: ["name", "id"]
        }
      }
    };
  }

  MIDIinputDevices() {
    return midiInputDevices;
  }

  midiDeviceInfo(args) {
    if (midiInputDevices[args.number] != null) {
      return midiDeviceInfo[args.number][(args.info == "id") ? 0 : 1];
    } else {
      return;
    }
  }

  noteOn(args) {
    return notesOn.includes(args.note);
  }

  noteVelocity(args) {
    if (notesOn.includes(args.note) && noteVelocities.find(subArray => subArray[0] === args.note)[1] !== undefined) {
      return noteVelocities.find(subArray => subArray[0] === args.note)[1];
    }
  }

  activeNotes() {
    return notesOn;
  }

  lastNotePressed() {
    return lastNotePressed;
  }    

  lastNoteReleased() {
    return lastNoteReleased;
  }    
}


//Copied from the 3D extension on scratch.
// ============== globalize vm and load extension ===============

function findReactComponent(element) {
  let fiber = element[Object.keys(element).find(key => key.startsWith("__reactInternalInstance$"))];
  if (fiber == null) return null;

  const go = fiber => {
      let parent = fiber.return;
      while (typeof parent.type == "string") {
          parent = parent.return;
      }
      return parent;
  };
  fiber = go(fiber);
  while(fiber.stateNode == null) {
      fiber = go(fiber);
  }
  return fiber.stateNode;
}

window.vm = findReactComponent(document.getElementsByClassName("stage-header_stage-size-row_14N65")[0]).props.vm;

(function() {
  var extensionInstance = new MIDI(window.vm.extensionManager.runtime)
  var serviceName = window.vm.extensionManager._registerInternalExtension(extensionInstance)
  window.vm.extensionManager._loadedExtensions.set(extensionInstance.getInfo().id, serviceName)
})()